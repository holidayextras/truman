'use strict'

let _ = require('lodash')
let RealXMLHttpRequest = window.XMLHttpRequest

module.exports = {

  getResponseHeadersObject (xhr) {
    let result = {}
    const headers = xhr.getAllResponseHeaders().split('\n')

    headers.forEach((header) => {
      let headerSegments = header.split(':')
      const key = headerSegments.shift()
      if (key) {
        result[key] = _.trim(headerSegments.join(':'))
      }
    })

    return result
  },

  getQueryStringObject (xhr, omitted) {
    const parser = document.createElement('a')
    parser.href = xhr.url

    const qsObj = parser.search.replace(/(^\?)/, '')
      .split('&')
      .map(function (n) {
        n = n.split('=')
        this[n[0]] = n[1]
        return this
      }.bind({}))[0]

    // Simple workaround for an edge case with the above code.
    if (_.isEqual(qsObj, { '': undefined })) {
      return {}
    }

    return _.omit(qsObj, omitted)
  },

  // WARNING: This function is a bit of a mindfuck. It's essentially making
  // any request data sent to real servers available on the fake XHR that we're
  // inspecting to build our fixtures so we can access/store it. Should probably
  // be done as a much cleaner PR to the Sinon project rather than a hack here.
  monkeyPatchXHR () {
    // 1. Push the fake XHR as a 'password' arg on to calls to 'open'.
    const oldOpen = window.XMLHttpRequest.prototype.open
    window.XMLHttpRequest.prototype.open = function () {
      let args = Array.prototype.slice.call(arguments)

      // Adding as an extra arg breaks jqXHR, so hijack password argument: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#open()
      while (args.length < 5) {
        args.push(undefined)
      }
      args[args.length - 1] = this

      return oldOpen.apply(this, args)
    }

    // 2. Intercept the fake XHR argument and add it as a property of the real XHR.
    const oldRealOpen = RealXMLHttpRequest.prototype.open
    RealXMLHttpRequest.prototype.open = function () {
      let args = Array.prototype.slice.call(arguments)

      if (args[args.length - 1] instanceof window.XMLHttpRequest) {
        this.originalFakeXHR = args.pop()
      }

      return oldRealOpen.apply(this, args)
    }

    // 3. When send is called on the real XHR, intercept the request data and push it back onto the fake XHR.
    const oldRealSend = RealXMLHttpRequest.prototype.send
    RealXMLHttpRequest.prototype.send = function (data) {
      if (this.originalFakeXHR) {
        this.originalFakeXHR.requestBody = data
      }
      return oldRealSend.apply(this, arguments)
    }
  },

  unMonkeyPatchXHR () {
    window.XMLHttpRequest.prototype.open = RealXMLHttpRequest.prototype.open
    window.XMLHttpRequest.prototype.send = RealXMLHttpRequest.prototype.send
  }

}
