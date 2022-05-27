'use strict'

const gulp = require('gulp')
const watch = require('gulp-watch')
const webpack = require('webpack-stream')
const webpackConfig = require('./webpack.config.js')
const del = require('del')
const notify = require('gulp-notify')
const connect = require('gulp-connect')
const connectRewrite = require('http-rewrite-middleware')
const open = require('gulp-open')
const rename = require('gulp-rename')
const util = require('util')

const SOURCE_CODE = './src/**/*.js'
const ENTRY_POINT = './src/truman.js'
const BUILD_DEST = './dist/'
const SANDBOX_DEST = './sandbox/'
const BUILT_FILES = './dist/*.js'

function logError (error) {
  const errorString = error.toString()
  notify.onError({
    title: 'Build Error',
    message: errorString
  })(error)
  console.log(errorString)
  this.emit('end')
}

const tasks = module.exports

// ---------------------------------
// --------- BUILD TASKS -----------
// ---------------------------------
tasks.clean = function clean () {
  return del(BUILT_FILES)
}

tasks.bundle = function bundle () {
  return gulp.src(ENTRY_POINT)
    .pipe(webpack(webpackConfig))
    .on('error', logError)
    .pipe(gulp.dest(BUILD_DEST))
    .pipe(gulp.dest(SANDBOX_DEST))
}

// ---------------------------------
// --------- WATCH TASKS -----------
// ---------------------------------
tasks.watch = function watch () {
  watch(SOURCE_CODE, function () {
    gulp.start('build')
  })
}

// ---------------------------------
// --------- SERVER TASKS ----------
// ---------------------------------
tasks.connect = function connectTask () {
  const middleware = connectRewrite.getMiddleware([
    { from: '^([^.]+[^/])$', to: '$1.html' }
  ])

  const cors = function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    next()
  }

  return connect.server({
    root: 'sandbox',
    port: 8082,
    livereload: true,
    middleware: function () {
      return [cors, middleware]
    }
  })
}

tasks.open = function open () {
  return gulp.src('./sandbox/index.html')
    .pipe(open({
      uri: 'http://localhost:8082',
      app: 'google chrome'
    }))
}

tasks.build = gulp.series(tasks.clean, tasks.bundle)

tasks.start = gulp.series(
  gulp.parallel(tasks.clean, tasks.connect),
  tasks.bundle,
  gulp.parallel(tasks.watch, tasks.open),
)

