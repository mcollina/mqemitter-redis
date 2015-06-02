'use strict'

var redis = require('./')
var test = require('tape').test
var abstractTests = require('mqemitter/abstractTest.js')

abstractTests({
  builder: redis,
  test: test
})

function noop () {}

test('actual unsubscribe from Redis', function (t) {
  var e = redis()

  e.subConn.on('message', function (topic, message) {
    t.fail('the message should not be emitted')
  })

  e.on('hello', noop)
  e.removeListener('hello', noop)
  e.emit({ topic: 'hello' }, function () {
    e.close(function () {
      t.end()
    })
  })
})
