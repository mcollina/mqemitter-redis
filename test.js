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

test('ioredis connect event', function (t) {
  var e = redis()

  var subConnectEventReceived = false
  var pubConnectEventReceived = false

  e.state.on('pubConnect', function () {
    pubConnectEventReceived = true
    newConnectionEvent()
  })

  e.state.on('subConnect', function () {
    subConnectEventReceived = true
    newConnectionEvent()
  })

  function newConnectionEvent () {
    if (subConnectEventReceived && pubConnectEventReceived) {
      e.close(function () {
        t.end()
      })
    }
  }
})

test('ioredis error event', function (t) {
  var e = redis({host: '127'})

  t.plan(2)

  var subErrorEventReceived = false
  var pubErrorEventReceived = false

  e.state.on('pubError', function (err) {
    t.deepEqual(err.message.substr(0, 14), 'connect EINVAL')
    pubErrorEventReceived = true
    newErrorEvent()
  })

  e.state.on('subError', function (err) {
    t.deepEqual(err.message.substr(0, 14), 'connect EINVAL')
    subErrorEventReceived = true
    newErrorEvent()
  })

  function newErrorEvent () {
    if (subErrorEventReceived && pubErrorEventReceived) {
      e.close(function () {
        t.end()
      })
    }
  }
})
