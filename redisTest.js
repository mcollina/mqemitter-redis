'use strict'

function noop () {}

function buildTests (opts) {
  var builder = opts.builder
  var isCluster = opts.isCluster
  var test = opts.test

  test('actual unsubscribe from Redis', function (t) {
    var e = builder()

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
    var e = builder()

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
    var e = isCluster ? builder({ cluster: { nodes: ['127'] } }) : builder({ host: '127' })

    t.plan(1)

    var subErrorEventReceived = false
    var pubErrorEventReceived = false

    e.state.once('pubError', function (err) {
      pubErrorEventReceived = true
      newErrorEvent(err)
    })

    e.state.once('subError', function (err) {
      subErrorEventReceived = true
      newErrorEvent(err)
    })

    function newErrorEvent (err) {
      if (subErrorEventReceived && pubErrorEventReceived) {
        if (isCluster) {
          t.deepEqual(err.message, 'Failed to refresh slots cache.')
        } else {
          t.deepEqual(err.message.substr(0, 7), 'connect')
        }
        e.close(function () {
          t.end()
        })
      }
    }
  })

  test('topic pattern adapter', function (t) {
    var e = builder()

    var mqttTopic = 'rooms/+/devices/+/status'
    var expectedRedisPattern = 'rooms/*/devices/*/status'

    var subTopic = e._subTopic(mqttTopic)

    t.plan(1)

    t.deepEqual(subTopic, expectedRedisPattern)

    e.close(function () {
      t.end()
    })
  })
}
module.exports = buildTests
