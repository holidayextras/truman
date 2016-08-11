'use strict';

const sinon = require('../../dependencies.js').sinon;
const expect = require('../../dependencies.js').expect;

const _ = require('lodash');
const fixtureHelper = require('../../../src/helpers/fixtures.js');
const xhrHelper = require('../../../src/helpers/xhr.js');

describe('FixtureHelper', ()=> {

  const sandbox = sinon.sandbox.create();
  const fakeXhr = {
    method: 'POST',
    requestHeaders: { request: 'headers', foo: 'bar', bar: 'foo' },
    url: 'https://foo.bar',
    requestBody: { request: 'body', foo: 'bar', bar: 'foo' },
    status: 'testStatus',
    responseText: '[{"foo":"bar"}]'
  };
  afterEach(() => sandbox.restore() );

  describe('initialize(options)', ()=> {

    beforeEach(()=> {
      sandbox.stub(_, 'assign');
    });

    it('assigns the config to the module', ()=> {
      fixtureHelper.initialize({ foo: 'bar' });
      expect(_.assign).to.have.been.calledWith(fixtureHelper._config, { foo: 'bar' });
    });

  });

  describe('sortByClosestMatchingURL', () => {

    let fixtures;

    beforeEach(() => {
      fixtures = [
        { request: { url: 'foo' } },
        { request: { url: 'bar' } },
        { request: { url: 'baz' } }
      ];
    });

    it('sorts a set of fixtures according to the request URL', () => {
      expect(fixtureHelper.sortByClosestMatchingURL(fixtures, { url: 'baz' })).to.eql([
        { request: { url: 'baz' } },
        { request: { url: 'bar' } },
        { request: { url: 'foo' } }
      ]);

      expect(fixtureHelper.sortByClosestMatchingURL(fixtures, { url: 'bar' })).to.eql([
        { request: { url: 'bar' } },
        { request: { url: 'baz' } },
        { request: { url: 'foo' } }
      ]);

      expect(fixtureHelper.sortByClosestMatchingURL(fixtures, { url: 'foo' })).to.eql([
        { request: { url: 'foo' } },
        { request: { url: 'bar' } },
        { request: { url: 'baz' } }
      ]);
    });

  });

  describe('addXhr(fixtures, xhr)', ()=> {

    let fixtures;

    beforeEach(() => {
      sandbox.stub(xhrHelper, 'getQueryStringObject').returns('queryString');
      sandbox.stub(xhrHelper, 'getResponseHeadersObject').returns({ headerName: 'headerVal' });

      fixtures = [{ foo: 'bar' }];
    });

    it('generates the query string object from the XHR and config', ()=> {
      fixtureHelper.addXhr(fixtures, fakeXhr);
      expect(xhrHelper.getQueryStringObject).to.have.been.calledWith(fakeXhr, fixtureHelper._config.omittedQueryParams);
    });

    it('generates the response headers object from the XHR', ()=> {
      fixtureHelper.addXhr(fixtures, fakeXhr);
      expect(xhrHelper.getResponseHeadersObject).to.have.been.calledWith(fakeXhr);
    });

    it('adds the xhr data to the given fixtures array', ()=> {
      fixtureHelper.addXhr(fixtures, fakeXhr);

      expect(fixtures.length).to.equal(2);
      expect(fixtures[0]).to.eql({ foo: 'bar' });
      expect(fixtures[1]).to.eql({
        request: {
          method: fakeXhr.method,
          headers: fakeXhr.requestHeaders,
          url: fakeXhr.url,
          query: 'queryString',
          body: fakeXhr.requestBody
        },
        response: {
          status: fakeXhr.status,
          headers: { headerName: 'headerVal' },
          body: fakeXhr.responseText
        }
      });
    });

  });

  describe('removeFirst(fixtures, fixture)', ()=> {

    let fixtures;

    it('removes the first matching fixture from the array of fixtures', ()=> {
      fixtures = [
        { foo: 'bar' },
        { bar: 'foo' },
        { baz: 'qux' }
      ];
      fixtureHelper.removeFirst(fixtures, { bar: 'foo' });
      expect(fixtures).to.eql([
        { foo: 'bar' },
        { baz: 'qux' }
      ]);
    });

    it('does not remove duplicate matches', ()=> {
      fixtures = [
        { foo: 'bar' },
        { bar: 'foo' },
        { baz: 'qux' },
        { bar: 'foo' }
      ];
      fixtureHelper.removeFirst(fixtures, { bar: 'foo' });
      expect(fixtures).to.eql([
        { foo: 'bar' },
        { baz: 'qux' },
        { bar: 'foo' }
      ]);
    });

  });

  describe('find(fixtures, options)', ()=> {

    describe('when a method option is present', ()=> {

      let fixtures;

      beforeEach(()=> {
        fixtures = [
          { request: { method: 'GET' } }
        ];
      });

      describe('when the option matches a fixture', ()=> {

        it('returns an array containing the match', ()=> {
          expect(fixtureHelper.find(fixtures, { method: 'GET' })).to.eql([{ request: { method: 'GET' } }]);
        });

      });

      describe('when the option does not match a fixture', ()=> {

        it('returns an empty array', ()=> {
          expect(fixtureHelper.find(fixtures, { method: 'PUT' })).to.eql([]);
        });

      });

    });

    describe('when the url option is present', ()=> {

      let fixtures;

      beforeEach(()=> {
        fixtures = [
          { request: { url: 'https://foo.com/bar/baz?bar=baz' } }
        ];

        fixtureHelper.initialize({ domainSynonyms: { 'https://foo.com': ['https://qux.com'] } });
      });

      describe('when the option matches a fixture', ()=> {

        it('returns an array containing the match', ()=> {
          expect(fixtureHelper.find(fixtures, { url: 'https://foo.com/bar/baz?bar=baz' })).to.eql([{ request: { url: 'https://foo.com/bar/baz?bar=baz' } }]);
        });

      });

      describe('when the option matches a domain synonym, which in turn matches a fixture with a path and some params', ()=> {

        it('returns an array containing the match', ()=> {
          expect(fixtureHelper.find(fixtures, { url: 'https://qux.com/bar/baz?bar=baz' })).to.eql([{ request: { url: 'https://foo.com/bar/baz?bar=baz' } }]);
        });

      });

      describe('when the option does not matcha fixture', ()=> {

        it('returns an empty array', ()=> {
          expect(fixtureHelper.find(fixtures, { url: 'https://bar.com?bar=baz' })).to.eql([]);
        });

      });

    });

    describe('when the query option is present', () => {

      let fixtures;

      describe('and there are no omittedQueryParams', () => {
        beforeEach(() => {
          fixtures = [
            { request: { query: {
              foo: 'bar'
            }}}
          ];
        });

        describe('when the option matches a fixture', () => {
          it('returns an array containing the match', () => {
            expect(fixtureHelper.find(fixtures, { query: { foo: 'bar' }})).to.eql([{ request: { query: { foo: 'bar' } } }]);
          });
        });

        describe('when the option does not match a fixture', () => {
          it('returns an empty array', () => {
            expect(fixtureHelper.find(fixtures, { query: { baz: 'qux' }})).to.eql([]);
          });
        });
      });

      // The input to this function already has the omitted params removed,
      // and when the fixtures are recorded for the first time the omitted
      // params are removed. This is effectively covering that if you were to
      // omit a param and already had fixtures recorded containing the param,
      // that they are still matched on a replay.
      describe('and there are omittedQueryParams', () => {
        beforeEach(() => {
          fixtureHelper.initialize({ omittedQueryParams: ['bar'] });
        });

        it('excludes them from the fixture for the purposes of matching', () => {
          fixtures = [
            { request: { query: {
              foo: 'bar',
              bar: 'baz'
            }}}
          ];
          expect(fixtureHelper.find(fixtures, { query: { foo: 'bar' }})).to.eql([{ request: { query: { foo: 'bar', bar: 'baz' } }}]);
        });
      });
    });

    describe('when the requestBody option is present', ()=> {

      let fixtures, fixture;

      describe('and is valid JSON', ()=> {

        describe('with a valid JSON fixture requestBody', ()=> {

          beforeEach(() => {
            fixture = { request: { body: '{"foo":"bar","bar":"foo"}' } };
            fixtures = [fixture];
            fixtureHelper.initialize({ omittedDataParams: ['bar'] });
          });

          describe('when the body matches', ()=> {

            it('returns an array containing the match', ()=> {
              expect(fixtureHelper.find(fixtures, { requestBody: '{"foo":"bar","bar":"foo"}' })).to.eql([fixture]);
            });

          });

          describe('when the body matches with configured parameters omitted', ()=> {

            it('returns an array containing the match', ()=> {
              expect(fixtureHelper.find(fixtures, { requestBody: '{"foo":"bar","bar":"baz"}' })).to.eql([fixture]);
            });

          });

          describe('when the body does not match', ()=> {

            it('returns an empty array', ()=> {
              expect(fixtureHelper.find(fixtures, { requestBody: '{"foo":"bar","qux":"foo"}' })).to.eql([]);
            });

          });

        });

        describe('with a valid JSON fixture requestBody containing an object nested in an array', ()=> {

          beforeEach(() => {
            fixture = { request: { body: '{"foo":"bar","bar":"foo","baz":{"bar":"foo", "bbb":[{"bar":"foo"}]}}' } };
            fixtures = [fixture];
            fixtureHelper.initialize({ omittedDataParams: ['bar'] });
          });

          describe('when the body matches with configured parameters omitted', ()=> {

            it('returns an array containing the match', ()=> {
              expect(fixtureHelper.find(fixtures, { requestBody: '{"foo":"bar","baz":{"bar":"kjndfkjbdf","bbb":[{"bar":"somethingelse"}]}}' })).to.eql([fixture]);
            });

          });

        });

        describe('with an invalid JSON fixture requestBody', ()=> {

          beforeEach(()=> {
            fixture = { request: { url: 'https://foo.bar', body: '{{{}}}}}' } };
            fixtures = [fixture];

            sandbox.stub(console, 'error');
          });

          it('logs an error to the console', ()=> {
            fixtureHelper.find(fixtures, { requestBody: '{}' });
            expect(console.error).to.have.been.calledWith('Could not parse fixture request body for', fixture.request.url, fixture.request.body);
          });

          it('optimistically returns an array containing the fixture even though no match was made', ()=> {
            expect(fixtureHelper.find(fixtures, { requestBody: '{}' })).to.eql([fixture]);
          });

        });

      });

      describe('and is invalid JSON', ()=> {

        beforeEach(()=> {
          fixture = { request: { body: '{"foo":"bar","bar":"foo"}' } };
          fixtures = [fixture];
          sandbox.stub(console, 'error');
        });

        it('logs an error to the console', ()=> {
          fixtureHelper.find(fixtures, { requestBody: '{{{}}}}}' });
          expect(console.error).to.have.been.calledWith('Could not parse option request body for', undefined, '{{{}}}}}');
        });

        it('optimistically returns an array containing the fixture even though no match was made', ()=> {
          expect(fixtureHelper.find(fixtures, { requestBody: '{{{}}}}}' })).to.eql([fixture]);
        });

      });

    });

  });

  describe('findForSinonXHR(fixtures, xhr)', ()=> {

    let fixtures;

    beforeEach(()=> {
      fixtures = [];
      sandbox.stub(xhrHelper, 'getQueryStringObject').returns('?foo=bar');
      sandbox.stub(fixtureHelper, 'find');
    });

    it('attempts to find a fixture with options built from the provided XHR', ()=> {
      fixtureHelper.findForSinonXHR(fixtures, fakeXhr);
      expect(fixtureHelper.find).to.have.been.calledWith(fixtures, {
        method: fakeXhr.method,
        url: fakeXhr.url,
        query: '?foo=bar',
        requestBody: fakeXhr.requestBody
      });
    });

  });

});
