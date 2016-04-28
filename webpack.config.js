'use strict'

const ExtractTextPlugin = require('extract-text-webpack-plugin')
const fs = require('fs')
const R = require('ramda')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const file = {
  src: './src/index.html',
  dest: 'index.html',
}

// regex helpers ---------------------------------------------------------------
const matchAll = R.curry((regex, index, str) => {
  regex.lastIndex = 0
  index = index || 0
  const matches = []
  let match = regex.exec(str)
  while (match != null) {
    matches.push(match[index])
    match = regex.exec(str)
  }
  return matches
})
const matchOne = R.curry((regex, index, str) => {
  regex.lastIndex = 0
  let match = regex.exec(str)
  return match && match[index]
})
const re = {
  tag: (name) => new RegExp(`(<${name})[^>]+>`, 'g'),
  attr: (name) => new RegExp(`${name}="([^"]+)"`, 'g'),
}
const attrEq = R.curry((attr, value, string) =>
  matchOne(re.attr(attr), 1, string) === value)

// ---------------------------------------------------------------------------

const getStylesheets = R.pipe(
  matchAll(re.tag('link'), 0),
  R.filter(attrEq('rel','stylesheet')),
  R.map(matchOne(re.attr('href'), 1))
)

const getJavaScript = R.pipe(
  matchAll(re.tag('script'), 0),
  R.map(matchOne(re.attr('src'), 1))
)

const getRequires = R.converge(
  R.concat,
  [getStylesheets, getJavaScript]
)

const writeRequire = file => `require("${file}");`

const makeHtmlBuildFile = R.pipe(
  getRequires,
  R.map(writeRequire),
  R.join('')
)

const strip = R.curry((char, string) => {
  let str = string
  if (R.head(string) === char) {
    str = R.tail(str)
  }
  if (R.last(string) === char) {
    str = R.init(string)
  }
  return str
})

const buildFileName = R.pipe(
  strip('.'),
  strip('/'),
  R.replace('/', '_'),
  R.replace(' ', '-'),
  R.concat('.build/')
)



const html = fs.readFileSync(file.src, 'utf8')
const entryContents = makeHtmlBuildFile(file.src)
rimraf.sync('.build')
rimraf.sync('dist')
mkdirp.sync('.build')
const entry = buildFileName(file.src)
fs.writeFileSync(entry, entryContents, 'utf8')



const removeStylesheet = R.curry((name, string) =>
  R.replace(new RegExp(`<link[^>]+href="${name}"[^>]*>`, 'g'), '', string))
const removeEachStylesheet = R.map(removeStylesheet, getStylesheets(html))
const removeAllStylesheets = R.apply(R.pipe, removeEachStylesheet)

const removeJavaScript = R.curry((name, string) =>
  R.replace(new RegExp(`<script[^>]+src="${name}"[^>]*>[^<]*</script>`, 'g'), '', string))
const removeEachJavaScript = R.map(removeJavaScript, getJavaScript(html))
const removeAllJavaScript = R.apply(R.pipe, removeEachJavaScript)

console.log(R.pipe(removeAllStylesheets, removeAllJavaScript)(html))


function PostProcessHtmlPlugin(opt) {
  this.src = opt.src
  this.dest = opt.dest
}

PostProcessHtmlPlugin.prototype.apply = function(compiler) {
  compiler.plugin('done', function() {
    // no idea how to parse the compiler / compilation for output files

  })
}

const css = new ExtractTextPlugin('css/[name]-[chunkhash].css')


module.exports = {
  entry: {
    home: entry
  },
  module: {
    loaders: [
      { test: /\.jpg$/, loader: 'file' },
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
    new PostProcessHtmlPlugin(file),
  ],
  resolve: {
    root: [
      __dirname,
      __dirname + '/src/',
    ]
  }
}