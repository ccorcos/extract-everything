'use strict'

module.exports = {
  files: {
    home: {
      src: './src/index.html',
      dest: 'index.html',
    },
    dashboard: {
      src: './src/dashboard/index.html',
      dest: 'dashboard/index.html',
    },
    package: {
      src: './src/package.js',
      dest: 'package.js',
    }
  },
  // XXX no chunking yet
  chunks: {
    common: ['home', 'dashboard'],
  },
  output: {
    path: './dist',
    publicPath: __dirname + '/dist/',
  },
  // XXX no dev server yet
  development: {
    serveStatic: './dist',
    proxy: {
      'api/*': 'http://localhost:8080/'
    },
  },
  // in development wrapcss just lets you use the style loader
  // otherwise we're extracting the css to a specific dest name
  loaders: wrapCss => [
    { test: /\.jpg$/, loader: 'file?name=assets/img/[name]-[hash].[ext]' },
    { test: /\.js$/, loader: 'babel', query: { presets: ['es2015', 'react', 'stage-0'] } },
    { test: /\.css$/, loader: wrapCss('css') },
  ],
  resolve: {
    root: [
      __dirname,
      __dirname + '/src',
    ]
  }
}
