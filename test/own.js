'use strict'

const redis = require('../')
const Redis = require('ioredis')
const { test } = require('node:test')

function noop () { }

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

test('ignored topics', async function (t) {
  t.plan(1)

  const e = redis()

  e.on('+', function () {
    t.assert.fail('the message should not be emitted')
  }, function () {
    e._ignoredTopicsSet.forEach(topic => {
      e.emit({ topic }, noop)
    })
  })

  await new Promise(resolve => {
    setTimeout(() => {
      e.close(function (err) {
        t.assert.ok(!err)
        resolve()
      })
    }, 100)
  })
})

test('empty ignored topics', async function (t) {
  t.plan(3)

  const e = redis()
  const originalIgnoredTopics = e._ignoredTopicsSet
  const totalIgnoredTopics = originalIgnoredTopics.size
  let ignoredTopics = 0
  e._ignoredTopicsSet = new Set()

  e.on('+', function () {
    ignoredTopics++
  }, function () {
    originalIgnoredTopics.forEach(topic => {
      e.emit({ topic }, noop)
    })
  })

  await new Promise(resolve => {
    setTimeout(() => {
      e.close(function (err) {
        t.assert.ok(!err)
        t.assert.notEqual(originalIgnoredTopics.size, 0)
        t.assert.equal(ignoredTopics, totalIgnoredTopics)
        resolve()
      })
    }, 100)
  })
})

test('bypassRedis delivers locally without publishing', async function (t) {
  t.plan(2)

  const local = redis({
    bypassRedis: function (topic) {
      return topic.startsWith('local/')
    }
  })
  const remote = redis()

  const localTopics = []
  const remoteTopics = []

  await new Promise(resolve => {
    local.on('+/1', function (msg, cb) {
      localTopics.push(msg.topic)
      cb()
    }, function () {
      remote.on('+/1', function (msg, cb) {
        remoteTopics.push(msg.topic)
        cb()
      }, function () {
        local.emit({ topic: 'local/1' }, function () {
          local.emit({ topic: 'shared/1' }, function () {
            setTimeout(resolve, 100)
          })
        })
      })
    })
  })

  t.assert.deepEqual(localTopics.sort(), ['local/1', 'shared/1'])
  t.assert.deepEqual(remoteTopics, ['shared/1'])

  await new Promise(resolve => local.close(resolve))
  await new Promise(resolve => remote.close(resolve))
})

test('ECONNREFUSED is not surfaced while ioredis retries', async function (t) {
  t.plan(1)

  const subConn = new Redis({ lazyConnect: true })
  const pubConn = new Redis({ lazyConnect: true })
  const e = redis({ subConn, pubConn })

  const seen = []
  e.state.on('error', function (err) {
    seen.push(err.code)
  })

  function fakeError (code) {
    const err = new Error(code)
    err.code = code
    return err
  }

  subConn.emit('error', fakeError('ECONNREFUSED'))
  pubConn.emit('error', fakeError('ECONNREFUSED'))
  subConn.emit('error', fakeError('ECONNRESET'))
  pubConn.emit('error', fakeError('ENOTFOUND'))

  t.assert.deepEqual(seen, ['ECONNRESET', 'ENOTFOUND'])

  await new Promise(resolve => e.close(resolve))
})
