'use strict'

const sinon = require('sinon')
const fixtureHelper = require('./helpers/fixtures.js')
const stateHelper = require('./helpers/state.js')
const xhrHelper = require('./helpers/xhr.js')
const loggingHelper = require('./helpers/logging.js')
const storage = require('./storage')

const Promise = require('lie')
const _ = require('lodash')

let opts = {
  omittedDomains: []
}
let storageFixtures = []

const RECORDING_STATE = 'recording'
const REPLAYING_STATE = 'replaying'

const truman = module.exports = {

  _storageFifo: Promise.resolve(),
  _initialized: false,

  initialize (options, callback) {
    const message = 'Truman is up and running!'
    opts = _.assign(opts, options)

    if (truman._initialized) {
      if (callback) {
        callback(message)
      }
      return Promise.resolve(message)
    }

    storage.initialize(options)
    fixtureHelper.initialize(options)

    return truman._restoreState().then(() => {
      truman._initialized = true
      loggingHelper.log(`%c${message}`, 'color: green')
      if (callback) {
        callback(message)
      }
      return message
    })
  },

  pull (fixtureName, fixture, callback) {
    if (truman.currentStatus()) {
      throw new Error('Cannot pull when in either a recording or replaying state, call `truman.restore()` first.')
    }
    return storage.pull(fixtureName, fixture).then(() => callback())
  },

  push (fixtureCollectionName, tag, callback) {
    if (truman.currentStatus()) {
      throw new Error('Cannot push when in either a recording or replaying state, call `truman.restore()` first.')
    }

    return truman._storageFifo.then(() => {
      return storage.push(fixtureCollectionName, tag)
        .then((fixtures) => {
          const message = `Stored ${fixtures.length} fixtures to database (tag: ${(tag || '[AUTO]')})`
          if (callback) {
            callback(message)
          }
          loggingHelper.log(`%c${message}`, 'color: green')
        })
        .catch((error) => {
          loggingHelper.error('%cERROR', 'color: red', error)
        })
    })
  },

  record (fixtureCollectionName, callback) {
    if (truman.currentStatus() === REPLAYING_STATE) {
      truman.restore()
    }

    return storage.load(fixtureCollectionName)
      .then((fixtures) => {
        // Want this available in memory.
        storageFixtures = fixtures

        // Sinon's fake XHR logs extra request info we'll need/want for our fixtures:
        sinon.useFakeXMLHttpRequest()

        // Always call through as we're recording and want to make the request:
        window.XMLHttpRequest.useFilters = true
        window.XMLHttpRequest.addFilter(() => true) // true = allow, false = stub

        // Set up listeners for storing.
        xhrHelper.monkeyPatchXHR()
        window.XMLHttpRequest.onCreate = (xhr) => {
          return truman._storeXHRWhenReady(xhr, fixtureCollectionName)
        }

        loggingHelper.log('%cRECORDING NEW FIXTURES', 'color: red')
      })
      .then(() => {
        stateHelper.updateState({
          fixtureCollectionName: fixtureCollectionName,
          status: RECORDING_STATE
        })
        if (callback) {
          callback()
        }
      })
  },

  replay (fixtureCollectionName, callback) {
    if (truman.currentStatus() === RECORDING_STATE) {
      truman.restore()
    }

    return storage.load(fixtureCollectionName)
      .then((fixtures) => {
        // Load all of our fixtures into a fake server.
        const fakeServer = sinon.fakeServer.create()
        fakeServer.autoRespond = true
        fakeServer.autoRespondAfter = 0
        fakeServer.respondWith(/.*/, (xhr) => {
          const matchingFixtures = fixtureHelper.findForSinonXHR(fixtures, xhr)
          const fixture = matchingFixtures[0]
          if (fixture) {
            // If we have more than one matching fixture we need to remove the one we're using from the
            // fixtures collection. This way, as we progress throuhg a replay we'll always be replaying
            // the correct fixture version.
            if (matchingFixtures.length > 1) {
              fixtureHelper.removeFirst(fixtures, fixture)
              truman._storageFifo = truman._storageFifo.then(() => storage.store(fixtures, fixtureCollectionName))
            }

            xhr.respond(fixture.response.status, fixture.response.headers, fixture.response.body)
            loggingHelper.log(`%cREPLAY%c: ${fixture.request.method} ${fixture.request.url}`, 'color: green', 'color: black')
            loggingHelper.log(xhr, fixture)
          } else {
            loggingHelper.log(`%cNOT FOUND%c: ${xhr.method} ${xhr.url}`, 'color: red', 'color: black')
            loggingHelper.log('Looking for XHR:', xhr)

            if (xhr.method === 'GET') {
              loggingHelper.log('Fixtures (closest URL first):', fixtureHelper.sortByClosestMatchingURL(fixtures, xhr))
            } else {
              loggingHelper.log('Fixtures:', fixtures)
            }
          }
        })

        // Send XHRs for which we have a match to the fake server to handle, allow the rest.
        window.XMLHttpRequest.useFilters = true
        window.XMLHttpRequest.filters = [ // Important to replace all existing filters here.
          (method, url) => {
            const foundFixtures = fixtureHelper.find(fixtures, { method: method, url: url }).length
            if (!foundFixtures) {
              loggingHelper.log(`%cCALLTHROUGH%c: ${url}`, 'color: grey', 'color: black')
              loggingHelper.log(fixtures)
            }
            return !foundFixtures // true = allow, false = stub
          },
          (method, url) => {
            // For omitted domains we don't even want to log a CALLTHROUGH
            const domain = fixtureHelper.domainFromUrl(url)
            return _.includes(opts.omittedDomains, domain)
          }
        ]

        stateHelper.updateState({
          fixtureCollectionName: fixtureCollectionName,
          status: REPLAYING_STATE
        })

        const message = `Replaying ${fixtures.length} stored fixtures`

        if (callback) {
          callback(message)
        }

        loggingHelper.log(`%c${message}`, 'color: green')
      })
  },

  restore () {
    truman._restoreXhr()
    stateHelper.updateState(null)
    loggingHelper.log('%cRESTORED%c: All XHR requests unstubbed.', 'color: green', 'color: black')
  },

  clear (fixtureCollectionName, callback) {
    return storage.clear(fixtureCollectionName)
      .then(() => {
        loggingHelper.log('%cCLEARED%c: All local fixtures cleared.', 'color: green', 'color: black')
        if (callback) {
          callback()
        }
      })
  },

  currentStatus () {
    return stateHelper.loadState().status || null
  },

  _restoreState () {
    const state = stateHelper.loadState()
    if (state.fixtureCollectionName) {
      if (state.status === RECORDING_STATE) {
        return truman.record(state.fixtureCollectionName)
      }

      if (state.status === REPLAYING_STATE) {
        return truman.replay(state.fixtureCollectionName)
      }
    }
    return Promise.resolve()
  },

  _restoreXhr () {
    window.XMLHttpRequest.restore()
    xhrHelper.unMonkeyPatchXHR()
  },

  _storeXHR (xhr, fixtureCollectionName) {
    if (_.includes(opts.omittedDomains, fixtureHelper.domainFromUrl(xhr.url))) {
      // Don't store fixtures for domains we don't care about
      return
    }

    loggingHelper.log(`%cRECORDING%c: ${xhr.url}`, 'color: red', 'color: black')
    fixtureHelper.addXhr(storageFixtures, xhr)
    xhr.fixtured = true
    truman._storageFifo = truman._storageFifo.then(() => storage.store(storageFixtures, fixtureCollectionName))
    return truman._storageFifo
  },

  // 'Ready' is when we have all the information about the XHR we're going to get.
  _storeXHRWhenReady (xhr, fixtureCollectionName) {
    xhr.addEventListener('load', () => {
      if (!xhr.fixtured) {
        truman._storeXHR(xhr, fixtureCollectionName)
      }
    })

    const oldOnReadyStateChange = xhr.onreadystatechange
    xhr.addEventListener('readystatechange', () => {
      if (xhr.readyState === window.XMLHttpRequest.DONE && !xhr.fixtured) {
        truman._storeXHR(xhr, fixtureCollectionName)
      }

      if (oldOnReadyStateChange) {
        oldOnReadyStateChange.apply(this, arguments)
      }
    })
  }
}
