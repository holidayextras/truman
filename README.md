[![Build Status](https://travis-ci.org/holidayextras/truman.svg?branch=master)](https://travis-ci.org/holidayextras/truman) [![Dependency Status](https://david-dm.org/holidayextras/truman.svg)](https://david-dm.org/)

# Truman ![Truman Logo](http://i.imgur.com/BkGRQbp.png)

### Simple test fixtures for single page apps

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

  // Domain synonyms let us treat requests to one domain as matches for requests to another. For example, you
  // may record your fixtures against a local copy of an API but want to make sure those fixtures are replayed
  // when requests to the staging copy of the API are made during your test run. Domain synonyms do just that.
  // In the example below we're saying 'https://staging.myapi.com', 'https://staging2.myapi.com' are synonymous
  // to 'http://localhost:8000'.
  domainSynonyms: {
    'http://localhost:8000': ['https://staging.myapi.com', 'https://staging2.myapi.com']
  }

  database: {
    // URL for the remote CouchDB database.
    url: 'https://mycouchdburl.com',

    // Username for the remote CouchDB database.
    user: 'mycouchuser',

    // Password for the remove CouchDB database.
    password: 'mycouchpassword'
  }    
}
```

The truman module exposes the following methods:

### initialize([config])

```javascript
truman.initialize([config])
```

`initialize` does exactly what is says on the tin, it initializes the truman module with some provided config. It also restores either the recording or replaying state of the Truman module if it has previously been set to record or replay (on another tab or prior to a page refresh). See the config options section for more details on what config truman accepts.

`initialize` returns a promise that resolves once initialization is complete.

### record(fixtureCollectionName, [callback])
```javascript
truman.record(fixtureCollectionName, [callback])
```
#### Parameters
 - **fixtureCollectionName**: A name for the collection of fixtures you're recording.
 - **callback**: An optional callback if you're not using promises yet.

`record` puts the Truman module into record mode, meaning all XHR requests and responses will be recorded to the named fixture collection in the order that they occur. The size of the local database is limited by the capabilities of your browser, as we defer to PouchDB for browser storage.

`record` returns a promise that resolves once the fixtures have begun recording. This promise is useful if you want to do something like only start your application once the module is recording.

### replay(fixtureCollectionName, [callback])
```javascript
truman.replay(fixtureCollectionName, [callback])
```

#### Parameters
- **fixtureCollectionName**: A name for the collection of fixtures you'd like to replay.
- **callback**: An optional callback if you're not using promises yet.

`replay` puts the Truman module into replay mode, meaning as each XHR request is made, the module will look for a matching fixture to replay from the fixture collection, instead of making the real request.

`replay` returns a promise that resolves once the fixtures have begun replaying. This promise is useful if you want to do something like only start your application once the module is replaying.

### push(fixtureCollectionName, tag, [callback])

```javascript
truman.push(fixtureCollectionName, tag, [callback])
```

#### Parameters
- **fixtureCollectionName**: A name for the collection of fixtures you'd like to push to your remote server from your browser.
- **tag**: A unique tag of the fixture collection. This is required as fixture collections are *versioned*. This can be anything you want, but something like git revisions might be useful so you can tie up commits with remotely stored fixture versions.
- **callback**: An optional callback if you're not using promises yet.

`push` takes a recorded fixture collection and pushes it to your remote database for persistence. `push` returns a promise that resolves once the fixture collection has been successfully pushed.

### pull(fixtureCollectionName, [tag(s)], [callback])

```javascript
truman.pull(fixtureCollectionName, [tag(s)], [callback])
```

#### Parameters
- **fixtureCollectionName**: A name for the collection of fixtures you'd like to pull from your remote database.
- **tag(s)**: The tags or tag of the version of the fixture collection you'd like to load. When given an array of tags Truman will use the first tag it finds a match for in the array, when given a string truman will attempt to match the tag exactly.
- **callback**: An optional callback if you're not using promises yet.

`pull` loads a recorded fixture collection from your remote database for into the browser. `pull` returns a promise that resolves once the fixtures have been successfully loaded from the remote database.

### restore()

```javascript
truman.restore()
```

`restore` simply stops any recording or replaying of fixtures currently in progress, and restores the XHR object to its original state.


### clear(fixtureCollectionName, [callback])

```javascript
truman.clear(fixtureCollectionName, [callback])
```
#### Parameters
- **fixtureCollectionName**: A name for the collection of fixtures you'd like to clear.
- **callback**: An optional callback if you're not using promises yet.

`clear` simply removes all local fixtures belonging to the provided fixture collection name. `clear` returns a promise that resolves once the specified fixture collection has been cleared.


### currentStatus()

```javascript
truman.currentStatus()
```

`currentStatus` returns the current status of the Truman module, either `'recording'`, `'replaying'` or `null`.

## Development

```
npm install   # Install dependencies
npm start     # Run dev server with sandbox page and live reloading
npm run lint  # Check code style

# Run the unit tests in node
npm test

# Run the unit tests in chrome
npm run karma

# Run the unit tests in multiple browsers, on Sauce Labs (replace xxx with your credentials)
USE_CLOUD=t SAUCE_USERNAME=xxx SAUCE_PASSWORD=xxx npm run karma
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information on making contributions.
