'use strict'

const redis = require('../')
const Redis = require('ioredis')
const { test } = require('node:test')

function noop () {}

test('actual unsubscribe from Redis', async function (t) {
  t.plan(1)
  await new Promise(resolve => {
    const e = redis()

    e.subConn.on('message', function (topic, message) {
      t.assert.fail('the message should not be emitted')
    })

    e.on('hello', noop)
    e.removeListener('hello', noop)
    e.emit({ topic: 'hello' }, function (err) {
      t.assert.ok(!err)
      e.close(resolve)
    })
  })
})

test('ioredis connect event', async function (t) {
  t.plan(2)

  await new Promise(resolve => {
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
      t.assert.ok(true, 'connect event received')
      if (subConnectEventReceived && pubConnectEventReceived) {
        e.close(resolve)
      }
    }
  })
})

test('ioredis error event', async function (t) {
  t.plan(1)

  await new Promise(resolve => {
    const e = redis({ host: '127' })
    e.state.once('error', function (err) {
      t.assert.deepEqual(err.message.substr(0, 7), 'connect')
      e.close(resolve)
    })
  })
})

test('topic pattern adapter', async function (t) {
  t.plan(1)

  await new Promise(resolve => {
    const e = redis()

    const mqttTopic = 'rooms/+/devices/+/status'
    const expectedRedisPattern = 'rooms/*/devices/*/status'

    const subTopic = e._subTopic(mqttTopic)
    t.assert.deepEqual(subTopic, expectedRedisPattern)
    e.close(resolve)
  })
})

test('ioredis connection string', async function (t) {
  t.plan(2)

  await new Promise(resolve => {
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
      t.assert.ok(true, 'connect event received')
      if (subConnectEventReceived && pubConnectEventReceived) {
        e.close(resolve)
      }
    }
  })
})

test('external redis pubConn and subConn', async function (t) {
  t.plan(4)

  await new Promise(resolve => {
    const externalRedisSubConn = new Redis()
    externalRedisSubConn.on('error', e => {
      t.assert.ok(!e)
    })
    externalRedisSubConn.on('connect', () => {
      t.assert.ok(true, 'redis subConn connected')
    })

    const externalRedisPubConn = new Redis()
    externalRedisPubConn.on('error', e => {
      t.assert.ok(!e)
    })
    externalRedisPubConn.on('connect', () => {
      t.assert.ok(true, 'redis pubConn connected')
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
          t.assert.equal(e.subConn, externalRedisSubConn, 'uses external redis subConn')
          t.assert.equal(e.pubConn, externalRedisPubConn, 'uses external redis pubConn')
          resolve()
        })
      }
    }
  })
})
