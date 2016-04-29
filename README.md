# A Generic JS Build Tool

This build tool uses Webpack, but does all the leg work and manual processing
to deal with html and css as well. Simply specify the entry points (html, css,
js) and this tool will do the rest!

```
npm i
node build/prod.js
```

## To Do

- chunking
- dev server
- handle generic style / js processing
- test that no other loaders test positive for the index.html file
- allow css / style entry point
- minify, configurable plugin, etc.
- make this as generic as possible around webpack