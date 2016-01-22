'use strict';

var jsdom = require('jsdom');
var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

global.XMLHttpRequest = XMLHttpRequest;
global.document = jsdom.jsdom('<!doctype html><html><body></body></html>');
global.window = document.defaultView;

window.XMLHttpRequest = XMLHttpRequest;
