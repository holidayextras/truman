'use strict';

let _ = require('lodash');

let stateHelper = module.exports = {

  updateState(newState) {
    if (!newState) {
      return localStorage.removeItem('truman');
    }

    let state = stateHelper.loadState();
    localStorage.setItem('truman', JSON.stringify(_.assign(state, newState)));
  },

  loadState() {
    return JSON.parse(localStorage.getItem('truman') || '{}');
  }

};
