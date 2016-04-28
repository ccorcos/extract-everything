'use strict'

const ExtractTextPlugin = require('extract-text-webpack-plugin')

const files = {
  // ex1: two pages to our website
  home: {
    src: './src/index.html',
    dest: 'index.html',
  },
  dashboard: {
    src: './src/dashboard/index.html',
    dest: 'dashboard/index.html'
  },
  // ex2: an npm package we want to publish
  package: {
    src: './src/package.js',
    dest: 'package.js'
  },
  // ex3: some css theme we want to publish
  theme: {
    src: './src/theme.css',
    dest: 'theme.css'
  },
}

const extract_loaders = [
  { test: /\.js$/, loader: 'babel' },
  { test: /\.html$/, loader: 'html?attrs=img:src link:href script:src' },
  { test: /\.css$/, loader: 'css' },
]

function getLoader(src) {
  return extract_loaders.find(loader => loader.test.exec(src)).loader
}

const plugins = []
const loaders = []

// create an extract text plugin to preserve names of the entry files.
Object.keys(files).forEach((name) => {
  const file = files[name]
  // extract to dest name
  const plugin = new ExtractTextPlugin(file.dest)
  // lookup loader for the src file
  const loader = getLoader(file.src)
  // extract it
  loaders.push({
    test: file.src,
    loader: plugin.extract(loader)
  })
  plugins.push(plugin)
})

// wrap extract loaders with plugin and set output with hashed name
extract_loaders.forEach(loader => {
  const plugin = new ExtractTextPlugin('assets/[name]-[chunkhash].[ext]')
  loaders.push({
    test: loader.test,
    loader: plugin.extract(loader.loader)
  })
  plugins.push(plugin)
})

// enter at all the file src
const entry = {}
Object.keys(files).forEach(name => {
  entry[name] = files[name].src
})

module.exports = {
  entry: entry,
  module: {
    loaders: loaders.concat([
      { test: /\.jpg$/, loader: 'file' },
    ])
  },
  output: {
    publicPath: __dirname + '/dist/',
    path: 'dist',
    filename: 'output.js'
  },
  plugins: plugins.concat([

  ]),
  resolve: {
    root: [
      __dirname,
      __dirname + '/src/',
    ]
  }
}