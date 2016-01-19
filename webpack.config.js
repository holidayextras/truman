var webpack = require('webpack');

var uglify = new webpack.optimize.UglifyJsPlugin({
  comments: false,
  sourceMap: false,
  mangle: false,
  compress: {
    warnings: false,
    drop_debugger: false
  }
});

module.exports = {
  entry: './src/truman.js',
  output: {
    path: __dirname,
    filename: 'truman.js',
    libraryTarget: "var",
    library: "truman"
  },
  module: {
    loaders: [
      {
        test: /\.js?$/,
        exclude: /(node_modules)/,
        loader: 'babel', // 'babel-loader' is also a legal name to reference
        query: {
          presets: ['es2015']
        }
      }
    ]
  },
  plugins: [uglify]
};
