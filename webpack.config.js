'use strict'

const webpack = require('webpack')
const path = require('path')

module.exports = {
  entry: './src/truman.js',
  output: {
    path: __dirname,
    filename: 'truman.js',
    libraryTarget: 'var',
    library: 'truman'
  },
  module: {
    rules: [{
      test: /\.js?$/,
      exclude: /(node_modules)/,
      use: [{
        loader: 'babel-loader',
        options: {
          presets: ['@babel/env']
        }
      }]
    }]
  },
  // optimization: {
  //   minimize: true
  // },
  recordsPath: path.resolve('/tmp/truman.webpack.json')
}
