'use strict'

const jsdom = require('jsdom/lib/old-api')
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest

global.XMLHttpRequest = XMLHttpRequest
global.document = jsdom.jsdom('<!doctype html><html><body></body></html>')
global.window = document.defaultView
window.locale = 'en'

// Workaround for https://github.com/chaijs/type-detect/pull/91
global.HTMLElement = window.HTMLElement

window.XMLHttpRequest = XMLHttpRequest
