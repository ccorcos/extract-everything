const R = require('ramda')

// pass an index > 0 to pull out a group from the regex
// regex -> number -> string -> [string]
const matchAll = R.curry((regex, index, str) => {
  regex.lastIndex = 0
  index = index || 0
  const matches = []
  var match = regex.exec(str)
  while (match != null) {
    matches.push(match[index])
    match = regex.exec(str)
  }
  return matches
})

// pass an index > 0 to pull out a group from the regex
// regex -> number -> string -> string
const matchOne = R.curry((regex, index, str) => {
  regex.lastIndex = 0
  var match = regex.exec(str)
  return match && match[index]
})

// remove leading and trailing characters. useful for cleaning up paths
// character -> string -> string
const strip = R.curry((char, string) => {
  var str = string
  if (R.head(string) === char) {
    str = R.tail(str)
  }
  if (R.last(string) === char) {
    str = R.init(string)
  }
  return str
})

const cleanPath = (string) =>
  string[string.length - 1] === '/' ? string.substr(0, string.length-1) : string

module.exports = {
  matchAll: matchAll,
  matchOne: matchOne,
  strip: strip,
  cleanPath: cleanPath,
}
