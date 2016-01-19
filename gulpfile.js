var gulp = require('gulp');
var watch = require('gulp-watch');
var webpack = require('webpack-stream');
var webpackConfig = require('./webpack.config.js');
var del = require('del');
var notify = require('gulp-notify');
var changed = require('gulp-changed');
var runSequence = require('run-sequence');

var SOURCE_CODE = './src/**/*.js';
var ENTRY_POINT = './src/truman.js';
var BUILD_DEST = './dist/';
var SANDBOX_DEST = './sandbox/';
var BUILT_FILES = './dist/*.js';

function logError (error) {
  var errorString = error.toString()
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
    .pipe(gulp.dest(BUILD_DEST))
    .pipe(gulp.dest(SANDBOX_DEST));
});

// ---------------------------------
// --------- WATCH TASKS -----------
// ---------------------------------
gulp.task('watch', function () {
  watch(SOURCE_CODE, function() {
    gulp.start('build');
  });
});

gulp.task('build', function(cb) {
  return runSequence('clean', 'bundle', cb)
});

gulp.task('start', function(cb) {
  return runSequence('build', 'watch', cb);
});
