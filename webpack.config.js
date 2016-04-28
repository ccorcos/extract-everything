'use strict'

const ExtractTextPlugin = require('extract-text-webpack-plugin')
const IndexHtmlPlugin = require('indexhtml-webpack-plugin')

const file = {
  src: './src/index.html',
  dest: 'index.html',
}

const css = new ExtractTextPlugin('css/[name]-[chunkhash].css')

module.exports = {
  entry: {
    home: file.src
  },
  module: {
    loaders: [
      { test: /\.html$/, loader: 'html?attrs=link:href script:src img:src' },
      { test: /\.jpg$/, loader: 'file?name=jpg/[name]-[hash].[ext]' },
      { test: /\.js$/, loader: 'babel' },
      { test: /\.css$/, loader: css.extract('css') },
    ]
  },
  output: {
    publicPath: __dirname + '/dist/',
    path: 'dist',
    filename: 'js/[name]-[chunkhash].js'
  },
  plugins: [
    css,
    new IndexHtmlPlugin('home', file.dest),
  ],
  context: __dirname,
  resolve: {
    root: [
      __dirname,
      __dirname + '/src/',
    ]
  }
}