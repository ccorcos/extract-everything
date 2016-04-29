const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const webpack = require('webpack')
const config = require('../build.config')
const path = require('path')
const createWebpackConfigs = require('./build')

rimraf.sync(path.resolve(config.output.path))
mkdirp.sync(path.resolve('.build'))

const webpackConfigs = createWebpackConfigs(config)
const phase1 = webpackConfigs[0]
const phase2 = webpackConfigs[1]

webpack(phase1).run((err, stats) => {
  if (err) { console.log(err) }
  webpack(phase2).run((err, stats) => {
    if (err) { console.log(err) }
    console.log('finished')
    rimraf.sync(path.resolve('.build'))
  })
})
