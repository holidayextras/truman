'use strict';

require('Base64');

let _ = require('lodash');
let PouchDB = require('pouchdb');

const NO_NAME_ERR_MSG = 'Fixture collection name not provided.';

let config = {};
let localDB = null;
let remoteDB = null;
let cachedRevisionMapping = null;

let fixtureHelper = module.exports = {
  initialize(options) {
    _.assign(config, options);
    window.PouchDB = PouchDB; // Necessary for the PouchDB Chrome inspector
    localDB = new PouchDB('truman');

    if (config.database) {
      let remoteConfig = {
        ajax: {
          timeout: 120000
        }
      };

      if (config.database.user && config.database.password) {
        remoteConfig.ajax.headers = {
          Authorization: 'Basic ' + window.btoa(config.database.user + ':' + config.database.password)
        };
      }

      remoteDB = new PouchDB(config.database.url, remoteConfig);
    }
  },

  load(fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    return fixtureHelper._loadFromDatabase(localDB, fixtureCollectionName);
  },

  store(fixtures, fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    let fixtureRecord = { _id: fixtureCollectionName, fixtures: fixtures };
    return fixtureHelper._storeToDatabase(localDB, fixtureCollectionName, fixtureRecord);
  },

  push(fixtureCollectionName, tag) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    return fixtureHelper.load(fixtureCollectionName)
      .then((fixtures) => {
        const fixtureRecord = { _id: fixtureCollectionName, fixtures: fixtures };

        return fixtureHelper._storeToDatabase(remoteDB, fixtureCollectionName, fixtureRecord, tag)
          .then(() => fixtures)
          .catch((err) => {
            console.error(err);
          });
      });
  },

  pull(fixtureCollectionName, tags) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    return fixtureHelper.getLatestRevisionMapping(fixtureCollectionName, tags)
      .then((latestRevisionMapping) => {

        if (!latestRevisionMapping) {
          return fixtureHelper._copyFromRemote(fixtureCollectionName, fixtureCollectionName);
        }

        return fixtureHelper._copyFromRemote(fixtureCollectionName, fixtureCollectionName, latestRevisionMapping.revision);
      });
  },

  clear(fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    return localDB.get(fixtureCollectionName)
      .catch(fixtureHelper._swallow404)
      .then((existingFixtureRecord) => {
        if (existingFixtureRecord) {
          existingFixtureRecord.fixtures = [];
          return localDB.put(existingFixtureRecord);
        }
      });
  },

  getLatestRevisionMapping(fixtureCollectionName, tags) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    if (!_.isArray(tags)) {
      tags = _.compact([tags]);
    }

    return fixtureHelper._getRevisionMapping(fixtureCollectionName)
      .then((fixtureRevisionMappings) => {
        return fixtureRevisionMappings.find((fixtureRevisionMapping) => _.includes(tags, fixtureRevisionMapping.tag));
      });
  },

  _getRevisionMapping(fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    if (cachedRevisionMapping) {
      return Promise.resolve(cachedRevisionMapping);
    }
    return remoteDB.get(fixtureCollectionName, { revs_info: true })
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

  _copyFromRemote(fixtureCollectionName, id, revision) {
    return fixtureHelper._loadFromDatabase(remoteDB, id, revision)
      .then((fixtures) => {
        return fixtureHelper.store(fixtures, fixtureCollectionName)
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
