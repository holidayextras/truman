'use strict';

const _ = require('lodash');
const omitDeep = require('omit-deep');
const xhrHelper = require('./xhr');
const levenshtein = require('fast-levenshtein');

let fixtureHelper = module.exports = {
  _config: {
    omittedQueryParams: [],
    omittedDataParams: [],
    domainSynonyms: {}
  },

  initialize(options) {
    _.assign(fixtureHelper._config, options);
  },

  addXhr(fixtures, xhr) {
    fixtures.push({
      request: {
        method: xhr.method,
        headers: xhr.requestHeaders,
        url: xhr.url,
        query: xhrHelper.getQueryStringObject(xhr, fixtureHelper._config.omittedQueryParams),
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
        const fixtureDomain = fixtureHelper.domainFromUrl(fixtureUrl);
        const fixtureDomainSynonyms = fixtureHelper._config.domainSynonyms[fixtureDomain] || [];

        const fixtureUrls = [fixtureUrl].concat(fixtureDomainSynonyms.map((domainSynonym) => fixtureUrl.replace(fixtureDomain, domainSynonym)));
        if (!_.includes(fixtureUrls, requestedUrl)) {
          return false;
        }
      }

      const filteredFixturedQuery = xhrHelper.getQueryStringObject({
        url: 'http://localhost/?' + Object.keys(fixture.request.query || {}).map(function(key) {
          return key + '=' + fixture.request.query[key];
        }).join('&')
      }, fixtureHelper._config.omittedQueryParams);

      if (options.query && !_.isEqual(options.query, filteredFixturedQuery)) {
        return false;
      }

      if (options.requestBody) {
        let parsedOptionRequestBody = null;

        try {
          parsedOptionRequestBody = omitDeep(JSON.parse(options.requestBody), fixtureHelper._config.omittedDataParams);
        } catch (e) {
          console.error('Could not parse option request body for', options.url, options.requestBody);
        }

        let parsedFixtureRequestBody = null;

        try {
          parsedFixtureRequestBody = omitDeep(JSON.parse(fixture.request.body), fixtureHelper._config.omittedDataParams);
        } catch (e) {
          console.error('Could not parse fixture request body for', fixture.request.url, fixture.request.body);
        }

        // We deliberately return true if either the fixture request body or option request body can't be parsed.
        if (parsedOptionRequestBody && parsedFixtureRequestBody && !_.isEqual(parsedOptionRequestBody, parsedFixtureRequestBody)) {
          return false;
        }
      }

      return true;
    });
  },

  sortByClosestMatchingURL(fixtures, xhr) {
    // Sort sorts in place, which we don't want to do, so we clone the array.
    fixtures = JSON.parse(JSON.stringify(fixtures));

    return fixtures.sort(function(a, b) {
      const aDistance = levenshtein.get(a.request.url, xhr.url);
      const bDistance = levenshtein.get(b.request.url, xhr.url);

      if (aDistance < bDistance) {
        return -1;
      }

      if (aDistance > bDistance) {
        return 1;
      }

      return 0;
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
    const queryStringObject = xhrHelper.getQueryStringObject(xhr, fixtureHelper._config.omittedQueryParams);
    const findObject = {
      method: xhr.method,
      url: xhr.url,
      query: queryStringObject,
      requestBody: xhr.requestBody
    };
    return fixtureHelper.find(fixtures, findObject);
  }
};
