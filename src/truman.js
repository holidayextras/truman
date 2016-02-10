'use strict';

let sinon = require('sinon');
let fixtureHelper = require('./helpers/fixtures.js');
let stateHelper = require('./helpers/state.js');
let xhrHelper = require('./helpers/xhr.js');
let loggingHelper = require('./helpers/logging.js');

let Promise = require('lie');
let _ = require('lodash');
var storageFixtures = [];

const RECORDING_STATE = 'recording';
const REPLAYING_STATE = 'replaying';

let truman = module.exports = {

  _storageFifo: Promise.resolve(),
  _initialized: false,

  initialize(options, callback) {
    const message = 'Truman is up and running!';

    if (truman._initialized) {
      if (callback) {
        callback(message);
      }
      return Promise.resolve(message);
    }

    fixtureHelper.initialize(options);
    return truman._restoreState().then(() => {
      truman._initialized = true;
      loggingHelper.log(`%c${message}`, 'color: green');
      if (callback) {
        callback(message);
      }
      return message;
    });
  },

  pull(fixtureCollectionName, tags, callback) {
    if (truman.currentStatus()) {
      throw new Error('Cannot pull when in either a recording or replaying state, call `truman.restore()` first.');
    }

    return fixtureHelper.getLatestRevisionMapping(fixtureCollectionName, tags)
      .then((latestRevisionMapping)=> {
        const latestTag = _.get(latestRevisionMapping, 'tag');
        return fixtureHelper.pull(fixtureCollectionName, latestTag)
          .then((fixtures) => {
            const message = `Loaded ${fixtures.length} fixtures from the database (tag: ${(latestTag || '[LATEST]')})`;
            if (callback) {
              callback(message);
            }
            loggingHelper.log(`%c${message}`, 'color: green');
          })
          .catch((error) => {
            loggingHelper.error('%cERROR', 'color: red', error);
          });
      });
  },

  push(fixtureCollectionName, tag, callback) {
    if (truman.currentStatus()) {
      throw new Error('Cannot push when in either a recording or replaying state, call `truman.restore()` first.');
    }

    return truman._storageFifo.then(() => {
      return fixtureHelper.push(fixtureCollectionName, tag)
        .then((fixtures) => {
          const message = `Stored ${fixtures.length} fixtures to database (tag: ${(tag || '[AUTO]')})`;
          if (callback) {
            callback(message);
          }
          loggingHelper.log(`%c${message}`, 'color: green');
        })
        .catch((error) => {
          loggingHelper.error('%cERROR', 'color: red', error);
        });
    });
  },

  record(fixtureCollectionName, callback) {
    if (truman.currentStatus() === REPLAYING_STATE) {
      truman.restore();
    }

    return fixtureHelper.load(fixtureCollectionName)
      .then((fixtures) => {
        // Want this available in memory.
        storageFixtures = fixtures;

        // Sinon's fake XHR logs extra request info we'll need/want for our fixtures:
        sinon.useFakeXMLHttpRequest();

        // Always call through as we're recording and want to make the request:
        XMLHttpRequest.useFilters = true;
        XMLHttpRequest.addFilter(() => true); // true = allow, false = stub

        // Set up listeners for storing.
        xhrHelper.monkeyPatchXHR();
        XMLHttpRequest.onCreate = (xhr) => {
          return truman._storeXHRWhenReady(xhr, fixtureCollectionName);
        };

        loggingHelper.log('%cRECORDING NEW FIXTURES', 'color: red');
      })
      .then(() => {
        stateHelper.updateState({
          fixtureCollectionName: fixtureCollectionName,
          status: RECORDING_STATE
        });
        if (callback) {
          callback();
        }
      });
  },

  replay(fixtureCollectionName, callback) {
    if (truman.currentStatus() === RECORDING_STATE) {
      truman.restore();
    }

    return fixtureHelper.load(fixtureCollectionName)
      .then((fixtures) => {
        // Load all of our fixtures into a fake server.
        let fakeServer = sinon.fakeServer.create();
        fakeServer.autoRespond = true;
        fakeServer.autoRespondAfter = 0;
        fakeServer.respondWith(/.*/, (xhr) => {
          const matchingFixtures = fixtureHelper.findForSinonXHR(fixtures, xhr);
          const fixture = matchingFixtures[0];
          if (fixture) {
            // If we have more than one matching fixture we need to remove the one we're using from the
            // fixtures collection. This way, as we progress throuhg a replay we'll always be replaying
            // the correct fixture version.
            if (matchingFixtures.length > 1) {
              fixtureHelper.removeFirst(fixtures, fixture);
              truman._storageFifo = truman._storageFifo.then(() => fixtureHelper.store(fixtures, fixtureCollectionName));
            }

            xhr.respond(fixture.response.status, fixture.response.headers, fixture.response.body);
            loggingHelper.log(`%cREPLAY%c: ${fixture.request.method} ${fixture.request.url}`, 'color: green', 'color: black');
            loggingHelper.log(xhr, fixture);
          } else {
            loggingHelper.log(`%cNOT FOUND%c: ${xhr.method} ${xhr.url}`, 'color: red', 'color: black');
            loggingHelper.log(xhr, fixtures);
          }
        });

        // Send XHRs for which we have a match to the fake server to handle, allow the rest.
        XMLHttpRequest.useFilters = true;
        XMLHttpRequest.filters = [ // Important to replace all existing filters here.
          (method, url) => {
            const foundFixtures = fixtureHelper.find(fixtures, { method: method, url: url }).length;
            if (!foundFixtures) {
              loggingHelper.log(`%cCALLTHROUGH%c: ${url}`, 'color: grey', 'color: black');
              loggingHelper.log(fixtures);
            }
            return !foundFixtures; // true = allow, false = stub
          }
        ];

        stateHelper.updateState({
          fixtureCollectionName: fixtureCollectionName,
          status: REPLAYING_STATE
        });

        const message = `Replaying ${fixtures.length} stored fixtures`;

        if (callback) {
          callback(message);
        }

        loggingHelper.log(`%c${message}`, 'color: green');
      });
  },

  restore() {
    truman._restoreXhr();
    stateHelper.updateState(null);
    loggingHelper.log('%cRESTORED%c: All XHR requests unstubbed.', 'color: green', 'color: black');
  },

  clear(fixtureCollectionName, callback) {
    return fixtureHelper.clear(fixtureCollectionName)
      .then(() => {
        loggingHelper.log('%cCLEARED%c: All local fixtures cleared.', 'color: green', 'color: black');
        if (callback) {
          callback();
        }
      });
  },

  currentStatus() {
    return stateHelper.loadState().status || null;
  },

  _restoreState() {
    const state = stateHelper.loadState();
    if (state.fixtureCollectionName) {
      if (state.status === RECORDING_STATE) {
        return truman.record(state.fixtureCollectionName);
      }

      if (state.status === REPLAYING_STATE) {
        return truman.replay(state.fixtureCollectionName);
      }
    }
    return Promise.resolve();
  },

  _restoreXhr() {
    XMLHttpRequest.restore();
    xhrHelper.unMonkeyPatchXHR();
  },

  _storeXHR(xhr, fixtureCollectionName) {
    loggingHelper.log(`%cRECORDING%c: ${xhr.url}`, 'color: red', 'color: black');
    fixtureHelper.addXhr(storageFixtures, xhr);
    xhr.fixtured = true;
    truman._storageFifo = truman._storageFifo.then(() => fixtureHelper.store(storageFixtures, fixtureCollectionName));
    return truman._storageFifo;
  },

  // 'Ready' is when we have all the information about the XHR we're going to get.
  _storeXHRWhenReady(xhr, fixtureCollectionName) {
    xhr.addEventListener('load', ()=> {
      if (!xhr.fixtured) {
        truman._storeXHR(xhr, fixtureCollectionName);
      }
    });

    const oldOnReadyStateChange = xhr.onreadystatechange;
    xhr.addEventListener('readystatechange', ()=> {
      if (xhr.readyState === XMLHttpRequest.DONE && !xhr.fixtured) {
        truman._storeXHR(xhr, fixtureCollectionName);
      }

      if (oldOnReadyStateChange) {
        oldOnReadyStateChange.apply(this, arguments);
      }
    });
  }
};
