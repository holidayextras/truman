var webpack = require('webpack');

module.exports = {
  entry: './src/truman.js',
  output: {
    path: __dirname,
    filename: 'truman.js'
  },
  module: {
    noParse: [
      /node_modules\/sinon\//,
    ],
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
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      comments: false,
      sourceMap: false,
      mangle: false,
      compress: {
        warnings: false
      }
    })
  ]
};
