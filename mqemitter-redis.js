'use strict'

var Redis = require('ioredis')
var MQEmitter = require('mqemitter')
var hyperid = require('hyperid')()
var inherits = require('inherits')
var LRU = require('lru-cache')
var msgpack = require('msgpack-lite')
var EE = require('events').EventEmitter
var assert = require('assert')

function MQEmitterRedis (opts) {
  if (!(this instanceof MQEmitterRedis)) {
    return new MQEmitterRedis(opts)
  }

  opts = opts || {}
  this._opts = opts

  var cluster = opts.cluster
  if (cluster && !Object.is(cluster, {})) {
    let nodes = cluster.nodes || []
    let clusterOptions = cluster.options || {}
    assert(nodes.length > 0, 'No Startup Nodes in cluster-enabled redis')
    this.subConn = new Redis.Cluster(nodes, clusterOptions)
    this.pubConn = new Redis.Cluster(nodes, clusterOptions)
  } else {
    this.subConn = new Redis(opts)
    this.pubConn = new Redis(opts)
  }

  this._id = hyperid()
  this._topics = {}

  this._cache = new LRU({
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
  var that = this

  setTimeout(() => {
    var handleClose = function () {
      Promise.all([
        that.subConn.quit().then(() => { that.subConn.disconnect() }),
        that.pubConn.quit().then(() => { that.pubConn.disconnect() })
      ]).then(() => { that._close(cb) })
    }

    Promise.all(this.subConn.ping).then(() => {
      var topic = '$SYS/' + this._id + '/redis/close'
      this.on(topic, () => {
        that.removeListener(topic, () => {})
        handleClose()
      }, () => {
        this.emit({ topic: topic, payload: 1 })
      })
    }).catch(handleClose)
  }, 1000)

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
    if (done) {
      return done(new Error('mqemitter-redis is closed'))
    }
  }

  this.pubConn.ping(() => {
    var packet = {
      id: hyperid(),
      msg: msg
    }

    this.pubConn.publish(msg.topic, msgpack.encode(packet)).catch(() => {})

    if (done) {
      setImmediate(done)
    }
  })
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
