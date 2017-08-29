'use strict'

const sinon = require('../dependencies.js').sinon
const expect = require('../dependencies.js').expect

const truman = require('../../src/truman.js')
const storage = require('../../src/storage')
const fixtureHelper = require('../../src/helpers/fixtures.js')
const stateHelper = require('../../src/helpers/state.js')
const xhrHelper = require('../../src/helpers/xhr.js')
const loggingHelper = require('../../src/helpers/logging.js')

const Promise = require('lie')

describe('truman.js', () => {
  // Set up our stub restoration for this suite.
  const sandbox = sinon.sandbox.create()

  beforeEach(() => sandbox.stub(loggingHelper, 'log'))
  afterEach(() => sandbox.restore())

  describe('initialize()', () => {
    let options = null

    beforeEach(() => {
      sandbox.stub(fixtureHelper, 'initialize')
      sandbox.stub(storage, 'initialize')
      sandbox.stub(truman, '_restoreState').returns(Promise.resolve())
      options = { foo: 'bar' }
      truman._initialized = false
    })

    it('initializes the fixture helper with the provided options', () => {
      truman.initialize(options)
      expect(fixtureHelper.initialize).to.have.been.calledWith(options)
    })

    it('initializes the storage with the provided options', () => {
      truman.initialize(options)
      expect(storage.initialize).to.have.been.calledWith(options)
    })

    it('restores the truman state', () => {
      truman.initialize(options)
      expect(truman._restoreState).to.have.been.calledOnce()
    })
  })

  describe('pull()', () => {
    beforeEach(() => {
      sandbox.stub(storage, 'getLatestRevisionMapping').returns(Promise.resolve({ tag: 'collectionTag' }))
      sandbox.stub(storage, 'pull').returns(Promise.resolve(['fixture']))
      sandbox.stub(truman, 'currentStatus')
    })

    describe('when the current status is not null', () => {
      beforeEach(() => {
        truman.currentStatus.returns('RECORDING')
      })

      it('throws an error', () => {
        expect(() => truman.pull('collectionName', 'collectionTag')).to.throw(Error)
      })
    })

    it('gets the latest revision mapping for the fixture and number of possible tags that may match that fixture.', () => {
      truman.pull('collectionName', ['foo', 'collectionTag', 'bar'])
      expect(storage.getLatestRevisionMapping).to.have.been.calledWith('collectionName', ['foo', 'collectionTag', 'bar'])
    })

    it('pulls the named fixture collection from the remote server', (done) => {
      truman.pull('collectionName', 'collectionTag').then(() => {
        expect(storage.pull).to.have.been.calledWith('collectionName', 'collectionTag')
        done()
      })
    })
  })

  describe('push()', () => {
    beforeEach(() => {
      sandbox.spy(truman._storageFifo, 'then')
      sandbox.stub(storage, 'push').returns(Promise.resolve(['fixture']))
      sandbox.stub(truman, 'currentStatus')
    })

    describe('when the current status is not null', () => {
      beforeEach(() => {
        truman.currentStatus.returns('RECORDING')
      })

      it('throws an error', () => {
        expect(() => truman.push('collectionName', 'collectionTag')).to.throw(Error)
      })
    })

    it('waits for the storage fifo to resolve', () => {
      truman.push('collectionName', 'collectionTag')
      expect(truman._storageFifo.then).to.have.been.calledOnce()
    })

    it('pushes the remote fixture collection to the remote server', (done) => {
      truman.push('collectionName', 'collectionTag').then(() => {
        expect(storage.push).to.have.been.calledWith('collectionName', 'collectionTag')
        done()
      })
    })
  })

  describe('record()', () => {
    beforeEach(() => {
      sandbox.stub(storage, 'load').returns(Promise.resolve(['fixture']))
      sandbox.stub(sinon, 'useFakeXMLHttpRequest')
      sandbox.stub(xhrHelper, 'monkeyPatchXHR')
      sandbox.stub(truman, 'currentStatus')
      window.XMLHttpRequest.addFilter = sinon.stub()
      sandbox.stub(stateHelper, 'updateState')
    })

    afterEach(() => {
      delete window.XMLHttpRequest.addFilter
    })

    it('loads the fixtures from the database', (done) => {
      truman.record('collectionName').then(() => {
        expect(storage.load).to.have.been.calledOnce()
        done()
      }).catch(done)
    })

    it('starts using the fake XHR provided by sinon', (done) => {
      truman.record('collectionName').then(() => {
        expect(sinon.useFakeXMLHttpRequest).to.have.been.calledOnce()
        done()
      }).catch(done)
    })

    it('adds a request filter for recording XHRs', (done) => {
      truman.record('collectionName').then(() => {
        expect(window.XMLHttpRequest.addFilter).to.have.been.calledOnce()
        done()
      }).catch(done)
    })

    it('applies further monkeypatching to the XHR', (done) => {
      truman.record('collectionName').then(() => {
        expect(xhrHelper.monkeyPatchXHR).to.have.been.calledOnce()
        done()
      }).catch(done)
    })

    it('sets the state to recording', (done) => {
      truman.record('collectionName').then(() => {
        expect(stateHelper.updateState).to.have.been.calledWith({
          fixtureCollectionName: 'collectionName',
          status: 'recording'
        })
        done()
      }).catch(done)
    })
  })

  describe('replay()', () => {
    let respondWithStub = null

    beforeEach(() => {
      sandbox.stub(storage, 'load').returns(Promise.resolve(['fixture']))
      respondWithStub = sinon.stub()
      sandbox.stub(sinon.fakeServer, 'create').returns({ respondWith: respondWithStub })
      sandbox.stub(truman, 'currentStatus')
      window.XMLHttpRequest.addFilter = sinon.stub()
      sandbox.stub(stateHelper, 'updateState')
    })

    afterEach(() => {
      delete window.XMLHttpRequest.addFilter
    })

    it('loads the fixture collection', (done) => {
      truman.replay('collectionName').then(() => {
        expect(storage.load).to.have.been.calledWith('collectionName')
        done()
      }).catch(done)
    })

    it('creates a fake server with sinon', (done) => {
      truman.replay('collectionName').then(() => {
        expect(sinon.fakeServer.create).to.have.been.calledOnce()
        done()
      }).catch(done)
    })

    it('attaches a response handler to the fake server', (done) => {
      truman.replay('collectionName').then(() => {
        expect(respondWithStub).to.have.been.calledOnce()
        done()
      }).catch(done)
    })

    it('attaches a response filter to the fake server', (done) => {
      truman.replay('collectionName').then(() => {
        expect(window.XMLHttpRequest.filters[0]).to.be.a('function')
        done()
      }).catch(done)
    })

    it('sets the state to replaying', (done) => {
      truman.replay('collectionName').then(() => {
        expect(stateHelper.updateState).to.have.been.calledWith({
          fixtureCollectionName: 'collectionName',
          status: 'replaying'
        })
        done()
      }).catch(done)
    })
  })

  describe('restore()', () => {
    beforeEach(() => {
      sandbox.stub(truman, '_restoreXhr')
      sandbox.stub(stateHelper, 'updateState')
    })

    it('restores the XHR to the browser default', () => {
      truman.restore()
      expect(truman._restoreXhr).to.have.been.calledOnce()
    })

    it('sets the state to null', () => {
      truman.restore()
      expect(stateHelper.updateState).to.have.been.calledOnce()
    })
  })

  describe('clear()', () => {
    beforeEach(() => {
      sandbox.stub(storage, 'clear').returns(Promise.resolve())
    })

    it('clears the named fixture collection from the database', () => {
      truman.clear('collectionName')
      expect(storage.clear).to.have.been.calledWith('collectionName')
    })
  })

  describe('currentStatus()', () => {
    beforeEach(() => {
      sandbox.stub(stateHelper, 'loadState').returns({ status: 'foo' })
    })

    it('returns the current state of the module', () => {
      expect(truman.currentStatus()).to.equal('foo')
    })
  })

  describe('_restoreState()', () => {
    let fakeState = null

    beforeEach(() => {
      fakeState = { fixtureCollectionName: 'foo' }
      sandbox.stub(stateHelper, 'loadState').returns(fakeState)
    })

    describe('when in a recording state', () => {
      beforeEach(() => {
        fakeState.status = 'recording'
        sandbox.stub(truman, 'record')
      })

      it('resumes recording', () => {
        truman._restoreState()
        expect(truman.record).to.have.been.calledOnce()
      })
    })

    describe('when in a replaying state', () => {
      beforeEach(() => {
        fakeState.status = 'replaying'
        sandbox.stub(truman, 'replay')
      })

      it('resumes replaying', () => {
        truman._restoreState()
        expect(truman.replay).to.have.been.calledOnce()
      })
    })
  })

  describe('_restoreXhr()', () => {
    beforeEach(() => {
      window.XMLHttpRequest.restore = sinon.stub()
      sandbox.stub(xhrHelper, 'unMonkeyPatchXHR')
    })

    afterEach(() => {
      delete window.XMLHttpRequest.restore
    })

    it('undoes the sinon patching on the XHR object', () => {
      truman._restoreXhr()
      expect(window.XMLHttpRequest.restore).to.have.been.calledOnce()
    })

    it('undoes the custom monkeypatching on the XHR object', () => {
      truman._restoreXhr()
      expect(xhrHelper.unMonkeyPatchXHR).to.have.been.calledOnce()
    })
  })

  describe('_storeXhr()', () => {
    beforeEach(() => {
      sandbox.stub(fixtureHelper, 'addXhr')
      sandbox.stub(storage, 'store').returns(Promise.resolve(['fixture']))
    })

    it('adds the given XHR to the database', () => {
      truman._storeXHR({ url: 'foo.bar' }, 'collectionName')
      expect(fixtureHelper.addXhr).to.have.been.calledOnce()
    })

    it('pushes the storage operation onto the storage fifo buffer', (done) => {
      truman._storeXHR({ url: 'foo.bar' }, 'collectionName').then(() => {
        expect(storage.store).to.have.been.calledWith(['fixture'], 'collectionName')
        done()
      })
    })
  })

  describe('_storeXHRWhenReady()', () => {
    let xhr = null

    beforeEach(() => {
      xhr = { addEventListener: sinon.stub() }
    })

    it('attaches an onload handler to the xhr', () => {
      truman._storeXHRWhenReady(xhr, 'collectionName')
      expect(xhr.addEventListener).to.have.been.calledWith('load')
    })

    it('attaches additional actions to the existing onreadystatechange handler for the xhr', () => {
      truman._storeXHRWhenReady(xhr, 'collectionName')
      expect(xhr.addEventListener).to.have.been.calledWith('readystatechange')
    })
  })
})
