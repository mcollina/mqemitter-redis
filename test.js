'use strict'

const redis = require('./')
const Redis = require('ioredis')
const test = require('tape').test
const abstractTests = require('mqemitter/abstractTest.js')

abstractTests({
  builder: redis,
  test
})

abstractTests({
  builder: function (opts) { return new redis.MQEmitterRedisPrefix('some_prefix/', opts) },
  test
})

function noop () {}

test('actual unsubscribe from Redis', function (t) {
  const e = redis()

  e.subConn.on('message', function (topic, message) {
    t.fail('the message should not be emitted')
  })

  e.on('hello', noop)
  e.removeListener('hello', noop)
  e.emit({ topic: 'hello' }, function (err) {
    t.notOk(err)
    e.close(function () {
      t.end()
    })
  })
})

test('ioredis connect event', function (t) {
  const e = redis()

  let subConnectEventReceived = false
  let pubConnectEventReceived = false

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
  const e = redis({ host: '127' })

  t.plan(1)

  e.state.once('error', function (err) {
    t.deepEqual(err.message.substr(0, 7), 'connect')
    e.close(function () {
      t.end()
    })
  })
})

test('topic pattern adapter', function (t) {
  const e = redis()

  const mqttTopic = 'rooms/+/devices/+/status'
  const expectedRedisPattern = 'rooms/*/devices/*/status'

  const subTopic = e._subTopic(mqttTopic)

  t.plan(1)

  t.deepEqual(subTopic, expectedRedisPattern)

  e.close(function () {
    t.end()
  })
})

test('ioredis connection string', function (t) {
  const e = redis({
    connectionString: 'redis://localhost:6379/0'
  })

  let subConnectEventReceived = false
  let pubConnectEventReceived = false

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

test('external redis pubConn and subConn', function (t) {
  t.plan(4)

  const externalRedisSubConn = new Redis()
  externalRedisSubConn.on('error', e => {
    t.notOk(e)
  })
  externalRedisSubConn.on('connect', () => {
    t.pass('redis subConn connected')
  })

  const externalRedisPubConn = new Redis()
  externalRedisPubConn.on('error', e => {
    t.notOk(e)
  })
  externalRedisPubConn.on('connect', () => {
    t.pass('redis pubConn connected')
  })

  const e = redis({
    subConn: externalRedisSubConn,
    pubConn: externalRedisPubConn
  })

  let subConnectEventReceived = false
  let pubConnectEventReceived = false

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
        t.equal(e.subConn, externalRedisSubConn, 'uses external redis subConn')
        t.equal(e.pubConn, externalRedisPubConn, 'uses external redis pubConn')
        t.end()
      })
    }
  }
})
