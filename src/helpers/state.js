'use strict'

let _ = require('lodash')

let stateHelper = module.exports = {

  updateState (newState) {
    if (!newState) {
      return window.localStorage.removeItem('autoFixture')
    }

    let state = stateHelper.loadState()
    window.localStorage.setItem('autoFixture', JSON.stringify(_.assign(state, newState)))
  },

  loadState () {
    return JSON.parse(window.localStorage.getItem('autoFixture') || '{}')
  }

}
