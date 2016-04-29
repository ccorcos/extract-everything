'use strict'

const ExtractTextPlugin = require('extract-text-webpack-plugin')
const IndexHtmlPlugin = require('indexhtml-webpack-plugin')
const fs = require('fs')
const R = require('ramda')
const glob = require('glob')
const path = require('path')
const clone = require('clone')
const utils = require('./utils')
const rimraf = require('rimraf')
const matchAll = utils.matchAll
const matchOne = utils.matchOne
const strip = utils.strip
const cleanPath = utils.cleanPath
// some helpful regex's
const re = {
  tag: (name) => new RegExp(`(<${name})[^>]+>`, 'g'),
  attr: (name) => new RegExp(`${name}="([^"]+)"`, 'g'),
}

const attrEq = R.curry((attr, value, string) =>
  matchOne(re.attr(attr), 1, string) === value)

// get all the stylesheet paths out of an html string
const getStylesheets = R.pipe(
  matchAll(re.tag('link'), 0),
  R.filter(attrEq('rel','stylesheet')),
  R.map(matchOne(re.attr('href'), 1))
)

// get all javascript files out of an html string
const getJavaScript = R.pipe(
  matchAll(re.tag('script'), 0),
  R.map(matchOne(re.attr('src'), 1))
)

// given a string, get all the Js and Css dependencies
const getJsAndCssDeps = R.converge(
  R.concat,
  [getStylesheets, getJavaScript]
)

// write a js require statement to require the file
const writeRequire = file => `require("${file}");`

// get all the deps and compile a js string to require them all
const makeHtmlBuildFile = R.pipe(
  getJsAndCssDeps,
  R.map(writeRequire),
  R.join('')
)

// given the file.src, lets create a unique name for the temporary file
const buildFileName = R.pipe(
  strip('.'),
  strip('/'),
  R.replace(/\//g, '_'),
  R.replace(/ /g, '-'),
  R.concat('.build/')
)

// given some paths and function to turn it into a regex pattern,
// return a function that removes those items from a string
// [x] -> (x -> regex) -> (string -> string)
const removeElems = (items, toPattern) => {
  const removeItems = R.curry((item, str) => {
    const regex = new RegExp(toPattern(item), 'g')
    return R.replace(regex, '', str)
  })
  const removeFns = R.map(removeItems, items)
  const removeAll = R.apply(R.pipe, removeFns)
  return removeAll
}

// remove html and css imports from html
// string -> string
const cleanHtml = (htmlString) => {
  const toCssPattern = name => `<link[^>]+href="${name}"[^>]*>`
  const removeCss = removeElems(getStylesheets(htmlString), toCssPattern)
  const toJsPattern = name => `<script[^>]+src="${name}"[^>]*>[^<]*</script>`
  const removeJs = removeElems(getJavaScript(htmlString), toJsPattern)
  return R.pipe(removeCss, removeJs)(htmlString)
}

// create string to inject back into html
const toScriptTag = file => `<script src="${file}"></script>`
const toLinkTag = file => `<link rel="stylesheet" href="${file}">`

// inserts a string before some query string
// string -> string -> string -> string
const insertBefore = R.curry((query, insertion, string) => {
  const index = string.indexOf(query)
  return string.substr(0, index)
    + insertion
    + query
    + string.substr(index + query.length, string.length - index - query.length)
})

const createWebpackConfigs = config => {

  // get path of output file relative to output directory
  const toOutputPath = file => path.relative(config.output.path, file)
  // take an output file an turn it into a file with public path
  const toPublicPath = file =>
    cleanPath(config.output.publicPath) + '/' + toOutputPath(file)

  // create a plugin to post-process html files
  // given the name of the entry point along with the src and dest paths for
  // the html file
  function PostProcessHtmlPlugin(name, opt) {
    this.name = name
    this.src = opt.src
    this.dest = opt.dest
  }

  PostProcessHtmlPlugin.prototype.apply = function(compiler) {
    compiler.plugin('done', () => {
      // delete the js file generated when processing the html file
      rimraf.sync(path.resolve(config.output.path, 'delete_me.js'))
      // read the new html file written by the indexhtml plugin which handles
      // linking any static assets inside the html file.
      const newHtml = fs.readFileSync(path.resolve(config.output.path, this.dest), 'utf8')
      // remove any js and css links from this file
      const emptyHtml = cleanHtml(newHtml)
      // find any css and js files that match the name for this entry point
      const injectCss = glob.sync(config.output.path + `/assets/css/${this.name}*.css`)
      const injectJs = glob.sync(config.output.path + `/assets/js/${this.name}*.js`)
      // generate html tags
      const cssLinkTags = injectCss.map(toPublicPath).map(toLinkTag).join('')
      const jsScriptTags = injectJs.map(toPublicPath).map(toScriptTag).join('')
      const resultHtml = R.pipe(
        // inject the css at the end of the head
        insertBefore("</head>", cssLinkTags),
        // inject the js at the end of the body
        insertBefore("</body>", jsScriptTags)
      )(emptyHtml)
      // overwrite the final html file
      fs.writeFileSync(path.resolve(config.output.path, this.dest), resultHtml, 'utf8')
    })
  }

  // we're going to need to run muliple webpack processses.
  // the main webpack process is going to handle all the js and css
  // we want to extract all css and hash it all. we pattern match on the name
  // to determine which scripts to inject into the final html

  const cssExtract = new ExtractTextPlugin('assets/css/[name]-[chunkhash].css')
  const webpackConfig = {
    entry: {}, // this will get filled later
    module: {
      loaders: config.loaders(cssExtract.extract.bind(cssExtract))
    },
    output: {
      publicPath: config.output.publicPath,
      path: config.output.path,
    },
    plugins: [
      cssExtract,
    ],
    resolve: config.resolve
  }

  // we're going to compile all the js and css files together for the web version
  const webpackHtmlJsConfig = clone(webpackConfig)
  // we're going to have multiple individual steps to compile just the html
  const webpackHtmlConfigs = []
  // output js files in the same format as the css and image files
  webpackHtmlJsConfig.output.filename = 'assets/js/[name]-[chunkhash].js'
  // when js is an entry point, we'll assume we're creating a package or something
  const webpackJsConfigs = []
  // for all the html entry files in the config
  // parse for css / js and create a temporary js file to load those
  // depenedencies.
  Object.keys(config.files).forEach(name => {
    const file = config.files[name]
    if (config.files[name].src.substr(-5, 5) === '.html') {
      // file.src = path.relative('..', file.src)
      // file.dest = path.relative('..', file.dest)
      const html = fs.readFileSync(file.src, 'utf8')
      const entryContents = makeHtmlBuildFile(html)
      const entryFilename = buildFileName(file.src)
      fs.writeFileSync(entryFilename, entryContents, 'utf8')
      // use this temparary file as an entry point
      webpackHtmlJsConfig.entry[name] = entryFilename
      // compile html webpack config
      const webpackHtmlConfig = clone(webpackConfig)
      // entry at the html file
      webpackHtmlConfig.entry[`${name}.html`] = file.src
      // use the html loader specifically for this file
      // this will resolve any images / static assets inside this html file
      webpackHtmlConfig.module.loaders.push({ test: /\.html$/, loader: 'html' })
      // this file can get deletes. It will be an empty js file
      webpackHtmlConfig.output.filename = 'delete_me.js'
      // compile index files to the destination
      webpackHtmlConfig.plugins.push(new IndexHtmlPlugin(`${name}.html`, file.dest))
      // post process the html files
      webpackHtmlConfig.plugins.push(new PostProcessHtmlPlugin(name, file))
      // keep track of all these html configs
      webpackHtmlConfigs.push(webpackHtmlConfig)
    } else if (config.files[name].src.substr(-3, 3) === '.js') {
      // simple entry and destination for standalone js file
      const webpackJsConfig = clone(webpackConfig)
      webpackJsConfig.entry[name] = file.src
      webpackJsConfig.output.filename = file.dest
      webpackJsConfigs.push(webpackJsConfig)
    } else if (config.files[name].src.substr(-4, 4) === '.css') {
      // XXX we'll do this later
    } else {
      console.warn("unknown entry type")
    }
  })
  // webpack needs to get run in two phases
  return [
    webpackJsConfigs.concat([webpackHtmlJsConfig]),
    webpackHtmlConfigs
  ]
}

module.exports = createWebpackConfigs
