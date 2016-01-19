# Truman (Work In Progress)

### Simple test fixtures for single page JavaScript applications

## About

### How it works
Truman was built with the sole purpose of making recording and replaying test fixtures simple for single page JavaScript applications. It works like so:

 - **Record new named test fixture collection**; intercepting all XHR requests and storing their data in a structured way while your application behaves like normal.
 - **Replay a named test fixture collection**; intercepting outgoing XHR requests and replaying matching fixtures accordingly from what you have stored.
 - **Push and pull fixture collections to a remote DB** from an external service (CouchDB instances only at the moment).

### Why the browser?
Fixturing directly within the browser makes sense for single page applications:

 - Avoid SSL issues associated with intercepting requests.
 - No need for external recording services.
 - No need to manually add every API you want to record requests for.
 - Can be controlled programmatically or via the browser console.
 - Debug close to your application, using the browser console.
 - In replay mode, responses are instantaneous as XHR requests are never actually made.

## Installation
Install via npm:

```
npm install truman --save
```

## Usage

### Config options

```javascript
let config = {
  // An array of query string parameters to omit from XHR comparison when matching fixtures.
  omittedQueryParams: ['sid', 'token'],

  // An array request body JSON parameters to omit from XHR comparison when matching fixtures.
  omittedDataParams: ['requestid'],

  // Name of the local PouchDB database.
  localPouchDB: 'fixtures',       

  // URL for the remote CouchDB database.
  remoteCouchDB: 'https://mycouchdburl.com',     

  // Username for the remote CouchDB database.
  remoteUser: 'mycouchuser',     

  // Password for the remove CouchDB database.
  remotePassword: 'mycouchpassword',     

  /*
   * Domain synonyms let us treat requests to one domain as matches for requests to another. For example, you
   * may record your fixtures against a local copy of an API but want to make sure those fixtures are replayed
   * when requests to the staging copy of the API are made during your test run. Domain synonyms do just that.
   * In the example below we're saying 'https://staging.myapi.com', 'https://staging2.myapi.com' are synonymous
   * to 'http://localhost:8000'.
   */

  domainSynonyms: {
    'http://localhost:8000': ['https://staging.myapi.com', 'https://staging2.myapi.com']
  }
}
```

The truman module exposes the following methods:

### record
```javascript
truman.record(fixtureCollectionName, [callback])
```
#### Parameters
 - **fixtureCollectionName**: A name for the collection of fixtures you're recording.
 - **callback**: An optional callback if you're not using promises yet.

`record` puts the Truman module into record mode, meaning all XHR requests and responses will be recorded to the named fixture collection in the order that they occur. The size of the local database is limited by the capabilities of your browser, as we defer to PouchDB for browser storage.

`record` returns a promise that resolves once the fixtures have begun recording. This promise is useful if you want to do something like only start your application once the module is recording.

### replay
```javascript
truman.replay(fixtureCollectionName, [callback])
```

#### Parameters
- **fixtureCollectionName**: A name for the collection of fixtures you'd like to replay.
- **callback**: An optional callback if you're not using promises yet.

`replay` puts the Truman module into replay mode, meaning as each XHR request is made, the module will look for a matching fixture to replay from the fixture collection, instead of making the real request.

`replay` returns a promise that resolves once the fixtures have begun replaying. This promise is useful if you want to do something like only start your application once the module is replaying.

### push

```javascript
truman.push(fixtureCollectionName, tag, [callback])
```

#### Parameters
- **fixtureCollectionName**: A name for the collection of fixtures you'd like to push to your remote server from your browser.
- **tag**: A unique tag of the fixture collection. This is required as fixture collections are *versioned*. This can be anything you want, but something like git revisions might be useful so you can tie up commits with remotely stored fixture versions.
- **callback**: An optional callback if you're not using promises yet.

`push` takes a recorded fixture collection and pushes it to your remote database for persistence. `push` returns a promise that resolves once the fixture collection has been successfully pushed.

### pull

```javascript
truman.pull(fixtureCollectionName, [tag], [callback])
```

#### Parameters
- **fixtureCollectionName**: A name for the collection of fixtures you'd like to pull from your remote database.
- **tag**: The tag of the version of the fixture collection you'd like to load.
- **callback**: An optional callback if you're not using promises yet.

`pull` loads a recorded fixture collection from your remote database for into the browser. `pull` returns a promise that resolves once the fixtures have been successfully loaded from the remote database.

### restoreState

```javascript
truman.restoreState()
```

`restoreState` restores either the recording or replaying state of the Truman module. Typically this will be run shortly after the module has loaded, and is useful for auto-starting recording or replaying on new tabs.

### initialize

```javascript
truman.initialize([config])
```

`initialize` does exactly what is says on the tin, it initalizes the truman module with some provided config. See the config options section for more details on what config truman accepts.

### restore

```javascript
truman.restore()
```

`restore` simply stops any recording or replaying of fixtures currently in progress, and restores the XHR object to its original state.


### clear

```javascript
truman.clear(fixtureCollectionName, [callback])
```
#### Parameters
- **fixtureCollectionName**: A name for the collection of fixtures you'd like to clear.
- **callback**: An optional callback if you're not using promises yet.

`clear` simply removes all local fixtures belonging to the provided fixture collection name. `clear` returns a promise that resolves once the specified fixture collection has been cleared.


### currentStatus

```javascript
truman.currentStatus()
```

`currentStatus` returns the current status of the Truman module, either `'recording'`, `'replaying'` or `null`.

## Config options
