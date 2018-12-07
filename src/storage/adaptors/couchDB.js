'use strict'

require('Base64')

const includes = require('lodash/includes')
const isArray = require('lodash/isArray')
const compact = require('lodash/compact')
const each = require('lodash/each')

const PouchDB = require('pouchdb')

const STORAGE_PREFIX = 'fixture-'
const NO_NAME_ERR_MSG = 'Fixture collection name not provided.'

let config = {}
let localDB = null
let remoteDB = null
let cachedRevisionMapping = null

const _ = {
  includes,
  isArray,
  compact,
  each
}

const fixtureHelper = module.exports = {
  initialize (options) {

    Object.assign(config, options)
    window.PouchDB = PouchDB // Necessary for the PouchDB Chrome inspector
    const localConfig = config.database ? {} : { revs_limit: 1, auto_compaction: true } // Force compaction when not syncing with a remote database
    localDB = new PouchDB('truman', localConfig)

    console.log({localDB})

    if (config.database) {
      const remoteConfig = {
        ajax: {
          timeout: 120000
        }
      }

      if (config.database.user && config.database.password) {
        remoteConfig.ajax.headers = {
          Authorization: 'Basic ' + window.btoa(config.database.user + ':' + config.database.password)
        }
      }

      remoteDB = new PouchDB(config.database.url, remoteConfig)
    }
  },

  load (fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG)
    }

    const id = fixtureHelper._buildId(fixtureCollectionName)

      console.log({ localDB })
    return fixtureHelper._loadFromDatabase(localDB, id)
  },

  store (fixtures, fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG)
    }

    const id = fixtureHelper._buildId(fixtureCollectionName)
    const fixtureRecord = { _id: id, fixtures: fixtures }

    return fixtureHelper._storeToDatabase(localDB, id, fixtureRecord)
  },

  push (fixtureCollectionName, tag) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG)
    }

    return fixtureHelper.load(fixtureCollectionName)
      .then((fixtures) => {
        const id = fixtureHelper._buildId(fixtureCollectionName)
        const fixtureRecord = { _id: id, fixtures: fixtures }

        return fixtureHelper._storeToDatabase(remoteDB, id, fixtureRecord, tag)
          .then(() => fixtures)
          .catch((err) => {
            console.error(err)
          })
      })
  },

  pull (fixtureCollectionName, fixtures) {
    return fixtureHelper.store(fixtures, fixtureCollectionName)
      .then(() => fixtures)
  },

  clear (fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG)
    }

    const id = fixtureHelper._buildId(fixtureCollectionName)

    return localDB.get(id)
      .catch(fixtureHelper._swallow404)
      .then((existingFixtureRecord) => {
        if (existingFixtureRecord) {
          existingFixtureRecord.fixtures = []
          return localDB.put(existingFixtureRecord)
        }
      })
  },

  getLatestRevisionMapping (fixtureCollectionName, tags) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG)
    }

    if (!_.isArray(tags)) {
      tags = _.compact([tags])
    }

    return fixtureHelper._getRevisionMapping(fixtureCollectionName)
      .then((fixtureRevisionMappings) => {
        return fixtureRevisionMappings.find((fixtureRevisionMapping) => _.includes(tags, fixtureRevisionMapping.tag))
      })
  },

  _getRevisionMapping (fixtureCollectionName) {
    if (!fixtureCollectionName) {
      throw new Error(NO_NAME_ERR_MSG)
    }

    if (cachedRevisionMapping) {
      return Promise.resolve(cachedRevisionMapping)
    }

    const id = fixtureHelper._buildId(fixtureCollectionName)

    return remoteDB.get(id, { revs_info: true })
      .catch(fixtureHelper._swallow404)
      .then((response) => {
        if (!response) {
          return []
        }

        const tagMapping = response.localRevisionMap
        const availableRevisions = response._revs_info
          .filter((revInfo) => revInfo.status === 'available')
          .map((revInfo) => revInfo.rev)

        const result = []

        _.each(availableRevisions, (revision) => {
          let matchingTag = null

          for (const tag in tagMapping) {
            if (Number.parseInt(revision.match(/[^-]+/)[0], 10) === tagMapping[tag]) {
              matchingTag = tag
              break
            }
          }

          result.push({ revision: revision, tag: matchingTag })
        })

        cachedRevisionMapping = result
        return result
      })
  },

  _storeToDatabase (database, id, fixtureRecord, tag) {
    return database.get(id)
      .catch(fixtureHelper._swallow404)
      .then((existingFixtureRecord) => {
        if (!existingFixtureRecord) {
          return database.put(fixtureRecord)
        }

        existingFixtureRecord.fixtures = fixtureRecord.fixtures

        if (!existingFixtureRecord.localRevisionMap) {
          existingFixtureRecord.localRevisionMap = {}
        }

        if (tag) {
          existingFixtureRecord.localRevisionMap[tag] = fixtureHelper._getNextRevisionNumber(existingFixtureRecord._rev)
        }

        return database.put(existingFixtureRecord)
      })
  },

  _loadFromDatabase (database, id, revision) {
    const options = {}

    if (revision) {
      options.rev = revision
    }

    return database.get(id, options)
      .then((fixture) => fixture.fixtures || [])
      .catch((err) => {
        fixtureHelper._swallow404(err)
        return []
      })
  },

  _copyFromRemote (fixtureCollectionName, id, revision) {
    return fixtureHelper._loadFromDatabase(remoteDB, id, revision)
      .then((fixtures) => {
        return fixtureHelper.store(fixtures, fixtureCollectionName)
          .then(() => fixtures)
      })
  },

  _getNextRevisionNumber (revision) {
    return Number.parseInt(revision.match(/[^-]+/)[0], 10) + 1
  },

  _buildId (fixtureCollectionName) {
    return STORAGE_PREFIX + fixtureCollectionName
  },

  // Swallow the error if the record doesn't exist yet...
  _swallow404 (err) {
    if (err.status !== 404) {
      throw err
    }
  }
}
