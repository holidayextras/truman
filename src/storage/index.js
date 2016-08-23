'use strict';

const couchDB = require('./adaptors/couchDB');

module.exports = {
  initialize(options) {
    return couchDB.initialize(options.couchDB);
  },

  /*
   * Load the latest version of the fixture with a given id from local storage.
   */
  load(id) {
    return couchDB.load(id);
  },

  /*
   * Store an array of fixtures under the the given id to local storage.
   * If a record already exists under this id, create a new version. Otherwise,
   * create the first version.
   */
  store(fixtures, id) {
    return couchDB.store(fixtures, id);
  },

  /*
   * Push the fixture record with the given id to remote storage, stored under
   * the given tag.
   */
  push(id, tag) {
    return couchDB.push(id, tag);
  },

  /*
   * Pull the fixture record with the given id and tag from remote storage.
   */
  pull(id, tags) {
    return couchDB.pull(id, tags);
  },

  /*
   * Remove the local fixture record with the given id.
   */
  clear(id) {
    return couchDB.clear(id);
  },

  /*
   * Remove the local fixture record with the given id.
   */
  getLatestRevisionMapping(id, tags) {
    return couchDB.getLatestRevisionMapping(id, tags);
  }
}
