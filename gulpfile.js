'use strict';

const gulp = require('gulp');
const watch = require('gulp-watch');
const webpack = require('webpack-stream');
const webpackConfig = require('./webpack.config.js');
const del = require('del');
const notify = require('gulp-notify');
const runSequence = require('run-sequence');
const connect = require('gulp-connect');
const connectRewrite = require('http-rewrite-middleware');
const open = require('gulp-open');
const rename = require('gulp-rename');

const SOURCE_CODE = './src/**/*.js';
const ENTRY_POINT = './src/truman.js';
const BUILD_DEST = './dist/';
const SANDBOX_DEST = './sandbox/';
const BUILT_FILES = './dist/*.js';

function logError(error) {
  const errorString = error.toString();
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
  const middleware = connectRewrite.getMiddleware([
    { from: '^([^.]+[^/])$', to: '$1.html' }
  ]);

  return connect.server({
    root: 'sandbox',
    livereload: true,
    middleware: function() {
      return [middleware];
    }
  });
});

gulp.task('open', function() {
  return gulp.src('./sandbox/index.html')
    .pipe(open({
      uri: 'http://localhost:8080',
      app: 'google chrome'
    }));
});


gulp.task('build', function(cb) {
  return runSequence('clean', 'bundle', cb);
});

gulp.task('start', function(cb) {
  return runSequence(['clean', 'connect'], 'bundle', ['watch', 'open'], cb);
});
