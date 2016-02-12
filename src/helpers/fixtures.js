'use strict';

let _ = require('lodash');
let omitDeep = require('omit-deep');
let xhrHelper = require('./xhr');

var config = {
  omittedQueryParams: [],
  omittedDataParams: [],
  domainSynonyms: []
};

let fixtureHelper = module.exports = {
  initialize(options) {
    _.assign(config, options);
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
          console.error('Could not parse option request body for', options.url, options.requestBody);
        }

        let parsedFixtureRequestBody = null;

        try {
          parsedFixtureRequestBody = omitDeep(JSON.parse(fixture.request.body), config.omittedDataParams);
        } catch (e) {
          console.error('Could not parse fixture request body for', fixture.request.url, fixture.request.body);
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
  }
};
