'use strict'

const ExtractTextPlugin = require('extract-text-webpack-plugin')
const IndexHtmlPlugin = require('indexhtml-webpack-plugin')
const fs = require('fs')
const R = require('ramda')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const glob = require('glob')
const path = require('path')

const config = {
  files: {
    home: {
      src: './src/index.html',
      dest: 'index.html',
    },
    dashboard: {
      src: './src/dashboard/index.html',
      dest: 'dashboard/index.html'
    }
  },
  output: {
    path: './dist',
    publicPath: __dirname + '/dist',
  },
}

rimraf.sync('.build')
rimraf.sync('dist')
mkdirp.sync('.build')

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

// util functions ------------------------------------------------------------

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

const buildFileName = R.pipe(
  strip('.'),
  strip('/'),
  R.replace(/\//g, '_'),
  R.replace(/ /g, '-'),
  R.concat('.build/')
)

const cleanHtml = (htmlString) => {
  const removeStylesheet = R.curry((name, string) =>
    R.replace(new RegExp(`<link[^>]+href="${name}"[^>]*>`, 'g'), '', string))
  const removeEachStylesheet = R.map(removeStylesheet, getStylesheets(htmlString))
  const removeAllStylesheets = R.apply(R.pipe, removeEachStylesheet)

  const removeJavaScript = R.curry((name, string) =>
    R.replace(new RegExp(`<script[^>]+src="${name}"[^>]*>[^<]*</script>`, 'g'), '', string))
  const removeEachJavaScript = R.map(removeJavaScript, getJavaScript(htmlString))
  const removeAllJavaScript = R.apply(R.pipe, removeEachJavaScript)

  return R.pipe(removeAllStylesheets, removeAllJavaScript)(htmlString)
}

// Plugin to post process html ------------------------------------------------

const convertToPublicPath = file =>
  config.output.publicPath + file.replace(config.output.path, '')


const putInScriptTag = file =>
 `<script src="${file}"></script>`

const putInLinkTag = file =>
  `<link rel="stylesheet" href="${file}">`

function PostProcessHtmlPlugin(name, opt) {
  this.name = name
  this.src = opt.src
  this.dest = opt.dest
}

PostProcessHtmlPlugin.prototype.apply = function(compiler) {
  compiler.plugin('done', () => {
    // delete the js file generated when processing the html file
    rimraf.sync(path.resolve(config.output.path, 'delete_me.js'))
    const newHtml = fs.readFileSync(path.resolve(config.output.path, this.dest), 'utf8')
    const emptyHtml = cleanHtml(newHtml)
    // find dist/css/*home* and dist/js/*home*
    const injectCss = glob.sync(config.output.path + `/assets/css/${this.name}*.css`)
    const injectJs = glob.sync(config.output.path + `/assets/js/${this.name}*.js`)
    // inject the css at the end of the head
    // inject the js at the end of the body
    const h = emptyHtml.indexOf("</head>")
    const b = emptyHtml.indexOf("</body>")
    const resultHtml = emptyHtml.substr(0, h) +
      injectCss.map(convertToPublicPath).map(putInLinkTag).join('') +
      "</head>" + emptyHtml.substr(h + "</head>".length, b - h - "</head>".length) +
      injectJs.map(convertToPublicPath).map(putInScriptTag).join('') +
      "</body>" + emptyHtml.substr(b + "</body>".length, emptyHtml.length - b - "</body>".length)
    fs.writeFileSync(path.resolve(config.output.path, this.dest), resultHtml, 'utf8')
  })
}

// webpack configs ------------------------------------------------------------


const webpackJsConfigs = []
const webpackHtmlConfigs = []

Object.keys(config.files).forEach(name => {
  const file = config.files[name]
  // read the html and parse the js/css
  const html = fs.readFileSync(file.src, 'utf8')
  // create a js file to load the js and css
  const entryContents = makeHtmlBuildFile(html)
  // create a temporary file in .build/
  const entry = buildFileName(file.src)
  fs.writeFileSync(entry, entryContents, 'utf8')
  // enter at the tmp file to compile js and css
  // and extract the css
  const cssExtract = new ExtractTextPlugin('assets/css/[name]-[chunkhash].css')
  webpackJsConfigs.push({
    entry: {
      [name]: entry,
    },
    module: {
      loaders: [
        { test: /\.jpg$/, loader: 'file?name=assets/img/[name]-[hash].[ext]' },
        { test: /\.js$/, loader: 'babel' },
        { test: /\.css$/, loader: cssExtract.extract('css') },
      ]
    },
    output: {
      publicPath: config.output.publicPath,
      path: config.output.path,
      filename: 'assets/js/[name]-[chunkhash].js'
    },
    plugins: [
      cssExtract,
    ],
    resolve: {
      root: [
        __dirname,
        __dirname + '/src/',
      ]
    }
  })
  // use IndexHtmlPlugin to handle linking any static assets. you could
  // probably do a lot more here.
  webpackHtmlConfigs.push({
    entry: {
      [`${name}.html`]: file.src,
    },
    module: {
      loaders: [
        { test: /\.jpg$/, loader: 'file?name=assets/img/[name]-[hash].[ext]' },
        { test: /\.html$/, loader: 'html' },
      ]
    },
    output: {
      publicPath: config.output.publicPath,
      path: config.output.path,
      filename: 'delete_me.js'
    },
    plugins: [
      new IndexHtmlPlugin(`${name}.html`, file.dest),
      new PostProcessHtmlPlugin(name, file)
    ],
    resolve: {
      root: [
        __dirname,
        __dirname + '/src/',
      ]
    }
  })
})

const webpack = require('webpack')
webpack(webpackJsConfigs).run((err, stats) => {
  console.log(err, stats)
  webpack(webpackHtmlConfigs).run((err, stats) => {
    console.log(err, stats)
  })
})


