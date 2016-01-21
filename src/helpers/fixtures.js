'use strict';

let _ = require('lodash');
let omitDeep = require('omit-deep');
let xhrHelper = require('./xhr');
let PouchDB = require('pouchdb');
let base64 = require('../lib/base64');

const STORAGE_PREFIX = 'fixture-';
const NO_NAME_ERR_MSG = 'Fixture collection name not provided.';

var config = {
  omittedQueryParams: [],
  omittedDataParams: [],
  domainSynonyms: [],
};

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
      }

      if (config.database.user && config.database.password) {
        remoteConfig.ajax.headers = {
          Authorization: 'Basic ' + base64.encode(config.database.user + ':' + config.database.password)
        }
      }

      remoteDB = new PouchDB(config.database.url, remoteConfig);
    }
  },

  load(fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    const id = fixtureHelper._buildId(fixtureCollectionName);

    return fixtureHelper._loadFromDatabase(localDB, id);
  },

  store(fixtures, fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    const id = fixtureHelper._buildId(fixtureCollectionName);
    let fixtureRecord = { _id: id, fixtures: fixtures };

    return fixtureHelper._storeToDatabase(localDB, id, fixtureRecord);
  },

  push(fixtureCollectionName, tag) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    return fixtureHelper.load(fixtureCollectionName)
      .then((fixtures) => {
        const id = fixtureHelper._buildId(fixtureCollectionName);
        const fixtureRecord = { _id: id, fixtures: fixtures };

        return fixtureHelper._storeToDatabase(remoteDB, id, fixtureRecord, tag)
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
        const id = fixtureHelper._buildId(fixtureCollectionName);

        if (!latestRevisionMapping) {
          return fixtureHelper._copyFromRemote(fixtureCollectionName, id);
        }

        return fixtureHelper._copyFromRemote(fixtureCollectionName, id, latestRevisionMapping.revision);
      })
  },

  clear(fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    const id = fixtureHelper._buildId(fixtureCollectionName);

    return localDB.get(id)
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

  addXhr(fixtures, xhr) {
    fixtures.push({
      request: {
        method: xhr.method,
        headers: xhr.requestHeaders,
        url: xhr.url,
        query: xhrHelper.getQueryStringObject(xhr, config.omittedQueryParams),
        body: xhr.requestBody
      },
      response: {
        status: xhr.status,
        headers: xhrHelper.getResponseHeadersObject(xhr),
        body: xhr.responseText
      }
    });
  },

  removeFirst(fixtures, fixture) {
    // Use old-school splicing instead of _.remove so we only remove the first match, not all matches.
    const spliceIndex = _.findIndex(fixtures, (currentFixture) => _.isEqual(currentFixture, fixture));
    fixtures.splice(spliceIndex, 1);
  },

  find(fixtures, options) {
    return _.filter(fixtures, (fixture) => {

      if (options.method && options.method !== fixture.request.method) {
        return false;
      }

      if (options.url) {
        // Sometimes things vary in the query string that don't affect request results,
        // so we exclude from the URL comparison and compare separately.
        const requestedUrl = options.url.split('?')[0];
        const fixtureUrl = fixture.request.url.split('?')[0];
        const fixtureDomain = fixtureHelper.domainFromUrl(fixture.request.url);
        const fixtureDomainSynonyms = config.domainSynonyms[fixtureDomain] || [];

        const fixtureUrls = [fixtureUrl].concat(fixtureDomainSynonyms.map((domainSynonym) => fixtureUrl.replace(fixtureDomain, domainSynonym)));

        if (!_.includes(fixtureUrls, requestedUrl)) {
          return false;
        }
      }

      if (options.query && !_.isEqual(options.query, fixture.request.query)) {
        return false;
      }

      if (options.requestBody) {
        let parsedOptionRequestBody = null;

        try {
          parsedOptionRequestBody = omitDeep(JSON.parse(options.requestBody), config.omittedDataParams);
        } catch (e) {
          console.error(e);
        }

        let parsedFixtureRequestBody = null;

        try {
          parsedFixtureRequestBody = omitDeep(JSON.parse(fixture.request.body), config.omittedDataParams);
        } catch (e) {
          console.error(e);
        }


        if (parsedOptionRequestBody && parsedFixtureRequestBody && !_.isEqual(parsedOptionRequestBody, parsedFixtureRequestBody)) {
          return false;
        }
      }

      return true;
    });
  },

  domainFromUrl(url) {
    const protocol = url.split('/')[0];
    const domain = url.split('/')[2];

    if (!protocol || !domain) {
      return null;
    }

    return `${protocol}//${domain}`;
  },

  findForSinonXHR(fixtures, xhr) {
    const queryStringObject = xhrHelper.getQueryStringObject(xhr, config.omittedQueryParams);
    const findObject = {
      method: xhr.method,
      url: xhr.url,
      query: queryStringObject,
      requestBody: xhr.requestBody
    };
    return fixtureHelper.find(fixtures, findObject);
  },

  _getRevisionMapping(fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG);
    }

    if (cachedRevisionMapping) {
      return Promise.resolve(cachedRevisionMapping);
    }

    const id = fixtureHelper._buildId(fixtureCollectionName);

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

  _buildId(fixtureCollectionName) {
    return STORAGE_PREFIX + fixtureCollectionName;
  },

  // Swallow the error if the record doesn't exist yet...
  _swallow404(err) {
    if (err.status !== 404) {
      throw err;
    }
  }
};
