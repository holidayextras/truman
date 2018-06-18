'use strict'

const stateHelper = module.exports = {

  updateState (newState) {
    if (!newState) {
      return window.localStorage.removeItem('autoFixture')
    }

    const state = stateHelper.loadState()
    window.localStorage.setItem('autoFixture', JSON.stringify(Object.assign(state, newState)))
  },

  loadState () {
    return JSON.parse(window.localStorage.getItem('autoFixture') || '{}')
  }

}
