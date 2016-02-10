'use strict';

let logImplementation = () => {}
let errorImplementation = () => {}

if (typeof console !== undefined) {
  if (console.log) {
    logImplementation = console.log.bind(console);
  }

  if (console.error) {
    errorImplementation = console.error.bind(console);
  }
}

let loggingHelper = module.exports = {
  log() {
    logImplementation.apply(null, arguments);
  },

  error() {
    errorImplementation.apply(null, arguments);
  }
};
