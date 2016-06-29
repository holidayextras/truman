'use strict';

var gulp = require('gulp');
var watch = require('gulp-watch');
var webpack = require('webpack-stream');
var webpackConfig = require('./webpack.config.js');
var del = require('del');
var notify = require('gulp-notify');
var runSequence = require('run-sequence');
var connect = require('gulp-connect');
var connectRewrite = require('http-rewrite-middleware');
var open = require('gulp-open');
var rename = require('gulp-rename');

var SOURCE_CODE = './src/**/*.js';
var ENTRY_POINT = './src/truman.js';
var BUILD_DEST = './dist/';
var SANDBOX_DEST = './sandbox/';
var BUILT_FILES = './dist/*.js';

function logError(error) {
  var errorString = error.toString();
  notify.onError({
    title: 'Build Error',
    message: errorString
  })(error);
  console.log(errorString);
  this.emit('end');
}

// ---------------------------------
// --------- BUILD TASKS -----------
// ---------------------------------
gulp.task('clean', function(callback) {
  return del(BUILT_FILES, callback);
});

gulp.task('bundle', function() {
  return gulp.src(ENTRY_POINT)
    .pipe(webpack(webpackConfig))
    .on('error', logError)
    .pipe(rename('truman.min.js'))
    .pipe(gulp.dest(BUILD_DEST))
    .pipe(gulp.dest(SANDBOX_DEST));
});

// ---------------------------------
// --------- WATCH TASKS -----------
// ---------------------------------
gulp.task('watch', function() {
  watch(SOURCE_CODE, function() {
    gulp.start('build');
  });
});


// ---------------------------------
// --------- SERVER TASKS ----------
// ---------------------------------
gulp.task('connect', function() {
  var middleware = connectRewrite.getMiddleware([
    { from: '^([^.]+[^/])$', to: '$1.html' }
  ]);

  return connect.server({
    root: 'sandbox',
    port: 8082,
    livereload: true,
    middleware: function() {
      return [middleware];
    }
  });
});

gulp.task('open', function() {
  return gulp.src('./sandbox/index.html')
    .pipe(open({
      uri: 'http://localhost:8082',
      app: 'google chrome'
    }));
});


gulp.task('build', function(cb) {
  return runSequence('clean', 'bundle', cb);
});

gulp.task('start', function(cb) {
  return runSequence(['clean', 'connect'], 'bundle', ['watch', 'open'], cb);
});
