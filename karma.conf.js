'use strict';

var customLaunchers = {
  win10chrome: { base: 'SauceLabs', browserName: 'chrome', platform: 'Windows 10' },
  win10ie11: { base: 'SauceLabs', browserName: 'internet explorer', platform: 'Windows 10' },
  win7ie9: { base: 'SauceLabs', browserName: 'internet explorer', platform: 'Windows 7', version: '9.0' }
};

module.exports = function(config) {
  config.set({
    browsers: [ 'Chrome' ],
    singleRun: true,
    frameworks: [ 'mocha' ],
    files: [
      'test/tests.webpack.js'
    ],
    preprocessors: {
      'test/tests.webpack.js': [ 'webpack', 'sourcemap' ]
    },
    reporters: [ 'spec', 'saucelabs' ],
    webpack: {
      devtool: 'inline-source-map',
      module: {
        loaders: [{
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          query: {
            presets: [ 'es2015' ]
          }
        }]
      }
    },
    webpackServer: {
      noInfo: true
    },
    client: {
      captureConsole: true,
      timeout: 10000
    }
  });

  if (process.env.USE_CLOUD) {
    config.customLaunchers = customLaunchers;
    config.browsers = Object.keys(customLaunchers);
    config.startConnect = true;
    config.connectOptions = {
      verbose: false,
      verboseDebugging: false
    };
    config.browserNoActivityTimeout = 30000;
  }
};
