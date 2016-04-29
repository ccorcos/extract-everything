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
  chunks: {
    common: ['home', 'dashboard'],
  },
  output: {
    path: './dist',
    publicPath: __dirname + '/dist/',
  },
  development: {
    serveStatic: './dist',
    proxy: {
      'api/*': 'http://localhost:8080/'
    },
  },
  loaders: extractCss => [
    { test: /\.jpg$/, loader: 'file?name=assets/img/[name]-[hash].[ext]' },
    { test: /\.js$/, loader: 'babel', query: { presets: ['es2015', 'react', 'stage-0'] } },
    { test: /\.css$/, loader: extractCss('css') },
  ],
  resolve: {
    root: [
      __dirname,
      __dirname + '/src',
    ]
  }
}
