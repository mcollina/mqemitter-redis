'use strict'

var test = require('tape').test

function runTests (builder, isCluster) {
  require('mqemitter/abstractTest.js')({
    builder: builder,
    isCluster: isCluster || false,
    test: test
  })
  require('./redisTest.js')({
    builder: builder,
    isCluster: isCluster || false,
    test: test
  })
}

runTests(require('./'))
runTests((opts) => {
  opts = {
    ...{
      cluster: {
        nodes: [{
          port: 30001,
          host: '127.0.0.1',
          db: 0
        }],
        options: {
          showFriendlyErrorStack: true
        }
      }
    },
    ...opts
  }
  return require('./')(opts)
}, true)
