'use strict';

let sinon = require('sinon');
let fixtureHelper = require('./helpers/fixtures.js');
let stateHelper = require('./helpers/state.js');
let xhrHelper = require('./helpers/xhr.js');
let Promise = require('lie');
var storageFixtures = [];

const RECORDING_STATE = 'recording';
const REPLAYING_STATE = 'replaying';

let autoFixture = module.exports = {

  _storageFifo: Promise.resolve(),

  initialize(options) {
    fixtureHelper.initialize(options);
  },

  restoreState() {
    const state = stateHelper.loadState();
    if (state.fixtureCollectionName) {
      if (state.status === RECORDING_STATE) {
        return autoFixture.record(state.fixtureCollectionName);
      }

      if (state.status === REPLAYING_STATE) {
        return autoFixture.replay(state.fixtureCollectionName);
      }
    }
    return Promise.resolve();
  },

  pull(fixtureCollectionName, revision, callback) {
    return fixtureHelper.pull(fixtureCollectionName, revision)
      .then((fixtures) => {
        const message = `Loaded ${fixtures.length} fixtures from the database (revision: ${(revision || '[LATEST]')})`;
        if (callback) {
          callback(message);
        }
        console.log(`%c${message}`, 'color: green');
      })
      .catch((error) => {
        console.error('%cERROR', 'color: red', error);
      });
  },

  push(fixtureCollectionName, tag, callback) {
    return autoFixture._storageFifo.then(() => {
      return fixtureHelper.push(fixtureCollectionName, tag)
        .then((fixtures) => {
          const message = `Stored ${fixtures.length} fixtures to database (tag: ${(tag || '[AUTO]')})`;
          if (callback) {
            callback(message);
          }
          console.log(`%c${message}`, 'color: green');
        })
        .catch((error) => {
          console.error('%cERROR', 'color: red', error);
        });
    });
  },

  record(fixtureCollectionName, callback) {
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
          return autoFixture._storeXHRWhenReady(xhr, fixtureCollectionName);
        };

        console.log('%cRECORDING NEW FIXTURES', 'color: red');
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
              autoFixture._storageFifo = autoFixture._storageFifo.then(() => fixtureHelper.store(fixtures, fixtureCollectionName));
            }
            xhr.respond(fixture.response.status, fixture.response.headers, fixture.response.body);
            console.log(`%cREPLAY%c: ${fixture.request.method} ${fixture.request.url}`, 'color: green', 'color: black');
            console.log(xhr, fixture);
          } else {
            console.log(`%cNOT FOUND%c: ${xhr.method} ${xhr.url}`, 'color: red', 'color: black');
            console.log(xhr, fixtures);
          }
        });

        // Send XHRs for which we have a match to the fake server to handle, allow the rest.
        XMLHttpRequest.useFilters = true;
        XMLHttpRequest.addFilter((method, url) => {
          const foundFixtures = fixtureHelper.find(fixtures, { method: method, url: url }).length;
          if (!foundFixtures) {
            console.log(`%cCALLTHROUGH%c: ${url}`, 'color: grey', 'color: black');
            console.log(fixtures);
          }
          return !foundFixtures; // true = allow, false = stub
        });

        stateHelper.updateState({
          fixtureCollectionName: fixtureCollectionName,
          status: REPLAYING_STATE
        });

        const message = `Replaying ${fixtures.length} stored fixtures`;

        if (callback) {
          callback(message);
        }

        console.log(`%c${message}`, 'color: green');
      });
  },

  restore() {
    autoFixture._restoreXhr();
    stateHelper.updateState(null);
    console.log('%cRESTORED%c: All XHR requests unstubbed.', 'color: green', 'color: black');
  },

  clear(fixtureCollectionName, callback) {
    return fixtureHelper.clear(fixtureCollectionName)
      .then(() => {
        console.log('%cCLEARED%c: All local fixtures cleared.', 'color: green', 'color: black');
        if (callback) {
          callback();
        }
      });
  },

  getRevisionMapping(fixtureCollectionName, callback) {
    return fixtureHelper.getRevisionMapping(fixtureCollectionName)
      .then((revisionMapping) => {
        if (callback) {
          callback(revisionMapping);
        }
        return revisionMapping;
      });
  },

  currentStatus() {
    return stateHelper.loadState().status || null;
  },

  _restoreXhr() {
    if (typeof XMLHttpRequest.restore === 'function') {
      XMLHttpRequest.restore();
    }
    xhrHelper.unMonkeyPatchXHR();
  },

  _storeXHR(xhr, fixtureCollectionName) {
    console.log(`%cRECORDING%c: ${xhr.url}`, 'color: red', 'color: black');
    fixtureHelper.addXhr(storageFixtures, xhr);
    xhr.fixtured = true;
    autoFixture._storageFifo = autoFixture._storageFifo.then(() => fixtureHelper.store(storageFixtures, fixtureCollectionName));
    return autoFixture._storageFifo;
  },

  // 'Ready' is when we have all the information about the XHR we're going to get.
  _storeXHRWhenReady(xhr, fixtureCollectionName) {
    xhr.onload = function() {
      if (!xhr.fixtured) {
        autoFixture._storeXHR(xhr, fixtureCollectionName);
      }
    };

    const oldOnReadyStateChange = xhr.onreadystatechange;
    xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE && !xhr.fixtured) {
        autoFixture._storeXHR(xhr, fixtureCollectionName);
      }

      if (oldOnReadyStateChange) {
        oldOnReadyStateChange.apply(this, arguments);
      }
    };
  }
};
