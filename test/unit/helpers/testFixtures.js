'use strict';

const sinon = require('../../dependencies.js').sinon;
const expect = require('../../dependencies.js').expect;

const _ = require('lodash');
const fixtureHelper = require('../../../src/helpers/fixtures.js');
const xhrHelper = require('../../../src/helpers/xhr.js');

describe('FixtureHelper', ()=> {

  const sandbox = sinon.sandbox.create();
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

  describe('addXhr(fixtures, xhr)', ()=> {

    let fixtures, fakeXhr;

    beforeEach(() => {
      sandbox.stub(xhrHelper, 'getQueryStringObject').returns('queryString');
      sandbox.stub(xhrHelper, 'getResponseHeadersObject').returns({ headerName: 'headerVal' });

      fixtures = [{ foo: 'bar' }];
      fakeXhr = {
        method: 'POST',
        requestHeaders: { request: 'headers', foo: 'bar', bar: 'foo' },
        url: 'https://foo.bar',
        requestBody: { request: 'body', foo: 'bar', bar: 'foo' },
        status: 'testStatus',
        responseText: '[{"foo":"bar"}]'
      };
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
          { request: { url: 'https://foo.com?bar=baz' } }
        ];

        fixtureHelper.initialize({ domainSynonyms: { 'https://foo.com': ['https://qux.com'] } });
      });

      describe('when the option matches a fixture', ()=> {

        it('returns an array containing the match', ()=> {
          expect(fixtureHelper.find(fixtures, { url: 'https://foo.com?bar=baz' })).to.eql([{ request: { url: 'https://foo.com?bar=baz' } }]);
        });

      });

      describe('when the option matches a domain synonym, which in turn matches a fixture', ()=> {

        it('returns an array containing the match', ()=> {
          expect(fixtureHelper.find(fixtures, { url: 'https://qux.com?bar=baz' })).to.eql([{ request: { url: 'https://foo.com?bar=baz' } }]);
        });

      });

      describe('when the option does not matcha fixture', ()=> {

        it('returns an empty array', ()=> {
          expect(fixtureHelper.find(fixtures, { url: 'https://bar.com?bar=baz' })).to.eql([]);
        });

      });

    });

    describe('when the query option is present', ()=> {

      let fixtures;

      beforeEach(()=> {
        fixtures = [
          { request: { query: '?foo=bar' } }
        ];
      });

      describe('when the option matches a fixture', ()=> {

        it('returns an array containing the match', ()=> {
          expect(fixtureHelper.find(fixtures, { query: '?foo=bar' })).to.eql([{ request: { query: '?foo=bar' } }]);
        });

      });

      describe('when the option does not match a fixture', ()=> {

        it('returns an empty array', ()=> {
          expect(fixtureHelper.find(fixtures, { query: '?baz=qux' })).to.eql([]);
        });

      });

    });

  });

  describe('domainFromUrl(url)', ()=> {



  });

  describe('findForSinonXHR(fixtures, xhr)', ()=> {

  });

});
