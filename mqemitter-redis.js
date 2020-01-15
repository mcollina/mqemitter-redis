'use strict'

var Redis = require('ioredis')
var MQEmitter = require('mqemitter')
var hyperid = require('hyperid')()
var inherits = require('inherits')
var LRU = require('lru-cache')
var msgpack = require('msgpack-lite')
var EE = require('events').EventEmitter

function MQEmitterRedis (opts) {
  if (!(this instanceof MQEmitterRedis)) {
    return new MQEmitterRedis(opts)
  }

  opts = opts || {}
  this._opts = opts

  this.subConn = new Redis(opts)
  this.pubConn = new Redis(opts)

  this._topics = {}

  this._cache = LRU({
    max: 10000,
    maxAge: 60 * 1000 // one minute
  })

  this.state = new EE()

  var that = this

  function handler (sub, topic, payload) {
    var packet = msgpack.decode(payload)
    if (!that._cache.get(packet.id)) {
      that._emit(packet.msg)
    }
    that._cache.set(packet.id, true)
  }

  this.subConn.on('messageBuffer', function (topic, message) {
    handler(topic, topic, message)
  })

  this.subConn.on('pmessageBuffer', function (sub, topic, message) {
    handler(sub, topic, message)
  })

  this.subConn.on('connect', function () {
    that.state.emit('subConnect')
  })

  this.subConn.on('error', function (err) {
    that.state.emit('subError', err)
  })

  this.pubConn.on('connect', function () {
    that.state.emit('pubConnect')
  })

  this.pubConn.on('error', function (err) {
    that.state.emit('pubError', err)
  })

  MQEmitter.call(this, opts)

  this._opts.regexWildcardOne = new RegExp(this._opts.wildcardOne.replace(/([/,!\\^${}[\]().*+?|<>\-&])/g, '\\$&'), 'g')
}

inherits(MQEmitterRedis, MQEmitter)

;['emit', 'on', 'removeListener', 'close'].forEach(function (name) {
  MQEmitterRedis.prototype['_' + name] = MQEmitterRedis.prototype[name]
})

MQEmitterRedis.prototype.close = function (cb) {
  var count = 2
  var that = this

  function onEnd () {
    if (--count === 0) {
      that._close(cb)
    }
  }

  this.subConn.on('end', onEnd)
  this.subConn.quit()

  this.pubConn.on('end', onEnd)
  this.pubConn.quit()

  return this
}

MQEmitterRedis.prototype._subTopic = function (topic) {
  return topic
    .replace(this._opts.regexWildcardOne, '*')
    .replace(this._opts.wildcardSome, '*')
}

MQEmitterRedis.prototype.on = function on (topic, cb, done) {
  var subTopic = this._subTopic(topic)
  var onFinish = function () {
    if (done) {
      setImmediate(done)
    }
  }

  this._on(topic, cb)

  if (this._topics[subTopic]) {
    this._topics[subTopic]++
    onFinish()
    return this
  }

  this._topics[subTopic] = 1

  if (this._containsWildcard(topic)) {
    this.subConn.psubscribe(subTopic, onFinish)
  } else {
    this.subConn.subscribe(subTopic, onFinish)
  }

  return this
}

MQEmitterRedis.prototype.emit = function (msg, done) {
  if (this.closed) {
    return done(new Error('mqemitter-redis is closed'))
  }

  var packet = {
    id: hyperid(),
    msg: msg
  }

  this.pubConn.publish(msg.topic, msgpack.encode(packet))
  if (done) {
    setImmediate(done)
  }
}

MQEmitterRedis.prototype.removeListener = function (topic, cb, done) {
  var subTopic = this._subTopic(topic)
  var onFinish = function () {
    if (done) {
      setImmediate(done)
    }
  }

  this._removeListener(topic, cb)

  if (--this._topics[subTopic] > 0) {
    onFinish()
    return this
  }

  delete this._topics[subTopic]

  if (this._containsWildcard(topic)) {
    this.subConn.punsubscribe(subTopic, onFinish)
  } else if (this._matcher.match(topic)) {
    this.subConn.unsubscribe(subTopic, onFinish)
  }

  return this
}

MQEmitterRedis.prototype._containsWildcard = function (topic) {
  return (topic.indexOf(this._opts.wildcardOne) >= 0) ||
         (topic.indexOf(this._opts.wildcardSome) >= 0)
}

module.exports = MQEmitterRedis
