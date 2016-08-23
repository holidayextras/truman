'use strict';

require('Base64');

const _ = require('lodash');
const PouchDB = window.PouchDB = require('pouchdb');
const DB_NAME = 'truman';
const REQUEST_TIMEOUT = 120000;

let localDB = null;
let remoteDB = null;
let cachedRevisionMapping = null;

let fixtureHelper = module.exports = {
  initialize(options) {
    localDB = new PouchDB(DB_NAME);

    const remoteConfig = {
      ajax: {
        timeout: REQUEST_TIMEOUT
      }
    };

    if (options.user && options.password) {
      remoteCOnfig.ajax.headers = {
        Authorization: 'Basic ' + window.btoa(options.user + ':' + options.password)
      };
    }

    remoteDB = new PouchDB(options.url, remoteConfig);
  },

  load(id) {
    return fixtureHelper._loadFromDatabase(localDB, id);
  },

  store(fixtures, id) {
    return fixtureHelper._storeToDatabase(localDB, id, {
      _id: id,
      fixtures
    });
  },

  push(id, tag) {
    return fixtureHelper.load(id)
      .then((fixtures) => {
        const fixtureRecord = {
          _id: id,
          fixtures
        };

        return fixtureHelper._storeToDatabase(remoteDB, id, fixtureRecord, tag)
          .then(() => fixtures)
          .catch((err) => {
            console.error(err);
          });
      });
  },

  pull(id, tags) {
    return fixtureHelper.getLatestRevisionMapping(id, tags)
      .then((latestRevisionMapping) => {
        const latestRevision = _.result(latestRevisionMapping, 'revision');
        return fixtureHelper._copyFromRemote(id, latestRevision)
      });
  },

  clear(id) {
    return localDB.get(id)
      .catch(fixtureHelper._swallow404)
      .then((existingFixtureRecord) => {
        if (existingFixtureRecord) {
          existingFixtureRecord.fixtures = [];
          return localDB.put(existingFixtureRecord);
        }
      });
  },

  getLatestRevisionMapping(id, tags) {
    tags = _.compact([].concat(tags)); // Forces an array and removes empty values

    return fixtureHelper._getRevisionMapping(id)
      .then((fixtureRevisionMappings) => {
        return fixtureRevisionMappings.find((fixtureRevisionMapping) => _.includes(tags, fixtureRevisionMapping.tag));
      });
  },

  _getRevisionMapping(id) {
    if (cachedRevisionMapping) {
      return Promise.resolve(cachedRevisionMapping);
    }
    return remoteDB.get(id, { revs_info: true })
      .catch(fixtureHelper._swallow404)
      .then((response) => {
        if (!response) {
          return [];
        }

        const tagMapping = response.localRevisionMap;
        const availableRevisions = response._revs_info
          .filter((revInfo) => revInfo.status === 'available')
          .map((revInfo) => revInfo.rev);

        let result = [];

        _.each(availableRevisions, (revision) => {
          let matchingTag = null;

          for (const tag in tagMapping) {
            if (Number.parseInt(revision.match(/[^-]+/)[0], 10) === tagMapping[tag]) {
              matchingTag = tag;
              break;
            }
          }

          result.push({ revision: revision, tag: matchingTag });
        });

        cachedRevisionMapping = result;
        return result;
      });
  },

  _storeToDatabase(database, id, fixtureRecord, tag) {
    return database.get(id)
      .catch(fixtureHelper._swallow404)
      .then((existingFixtureRecord) => {
        if (!existingFixtureRecord) {
          return database.put(fixtureRecord);
        }

        existingFixtureRecord.fixtures = fixtureRecord.fixtures;

        if (!existingFixtureRecord.localRevisionMap) {
          existingFixtureRecord.localRevisionMap = {};
        }

        if (tag) {
          existingFixtureRecord.localRevisionMap[tag] = fixtureHelper._getNextRevisionNumber(existingFixtureRecord._rev);
        }

        return database.put(existingFixtureRecord);
      });
  },

  _loadFromDatabase(database, id, revision) {
    let options = {};

    if (revision) {
      options.rev = revision;
    }

    return database.get(id, options)
      .then((fixture) => fixture.fixtures || [])
      .catch((err) => {
        fixtureHelper._swallow404(err);
        return [];
      });
  },

  _copyFromRemote(id, revision) {
    return fixtureHelper._loadFromDatabase(remoteDB, id, revision)
      .then((fixtures) => {
        return fixtureHelper.store(fixtures, id)
          .then(() => fixtures);
      });
  },

  _getNextRevisionNumber(revision) {
    return Number.parseInt(revision.match(/[^-]+/)[0], 10) + 1;
  },

  // Swallow the error if the record doesn't exist yet...
  _swallow404(err) {
    if (err.status !== 404) {
      throw err;
    }
  }
};
