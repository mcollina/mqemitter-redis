
var redis     = require('redis')
  , MQEmitter = require('mqemitter')
  , shortid   = require('shortid')
  , inherits  = require('inherits')
  , LRU       = require("lru-cache")

function MQEmitterRedis(opts) {
  if (!(this instanceof MQEmitterRedis)) {
    return new MQEmitterRedis(opts)
  }

  opts          = opts || {}

  this._opts    = opts

  this.subConn  = createConn(opts)
  this.pubConn  = createConn(opts)

  this._topics  = {}

  this._cache   = LRU({
                      max: 1000
                    , maxAge: 60 * 1000 // one minute
                  })

  var that      = this

  function handler(sub, topic, payload) {
    var packet = JSON.parse(payload)
    if (!that._cache.get(packet.id))
      that._emit(packet.msg)
    that._cache.set(packet.id, true)
  }

  this.subConn.on("message", function (topic, message) {
    handler(topic, topic, message);
  })

  this.subConn.on("pmessage", function(sub, topic, message) {
    handler(sub, topic, message);
  })

  MQEmitter.call(this, opts)
}

inherits(MQEmitterRedis, MQEmitter)

function createConn(opts) {
  var conn = redis.createClient(opts.port || null,
                                opts.host || null,
                                opts.redis)

  if (opts.password !== undefined) {
    conn.auth(opts.password);
  }

  conn.select(opts.db || 0);
  conn.retry_backoff = 5;

  return conn;
}

['emit', 'on', 'removeListener', 'close'].forEach(function(name) {
  MQEmitterRedis.prototype['_' + name] = MQEmitterRedis.prototype[name]
})

MQEmitterRedis.prototype.close = function close(cb) {
  var count = 2
    , that  = this

  function onEnd() {
    if (--count === 0)
      that._close(cb)
  }

  this.subConn.on('end', onEnd)
  this.subConn.quit()

  this.pubConn.on('end', onEnd)
  this.pubConn.quit()

  return this
}

MQEmitterRedis.prototype._subTopic = function(topic) {
   return topic.replace(this._opts.wildcardOne, '*')
               .replace(this._opts.wildcardSome, '*')
}

MQEmitterRedis.prototype.on = function on(topic, cb) {
  var subTopic = this._subTopic(topic)

  this._on(topic, cb)

  if (this._topics[subTopic]) {
    this._topics[subTopic]++
    return this
  }

  this._topics[subTopic] = 1

  if (this._containsWildcard(topic)) {
    this.subConn.psubscribe(subTopic);
  } else {
    this.subConn.subscribe(subTopic);
  }

  return this
}

MQEmitterRedis.prototype.emit = function emit(msg, done) {
  if (this.closed)
    return done(new Error('mqemitter-redis is closed'))

  var packet = {
      id: shortid()
    , msg: msg
  }

  this.pubConn.publish(msg.topic, JSON.stringify(packet), function() {
    setImmediate(done);
  });
}

MQEmitterRedis.prototype.removeListener = function removeListener(topic, cb) {
  var subTopic = this._subTopic(topic)

  this._removeListener(topic, cb)

  if (--this._topics[subTopic] > 0)
    return this

  delete this._topics[subTopic]

  if (this._containsWildcard(topic)) {
    this.subConn.punsubscribe(subTopic);
  } else if (this._matcher.match(topic)) {
    this.subConn.unsubscribe(subTopic);
  }

  return this
}

MQEmitterRedis.prototype._containsWildcard = function(topic) {
  return (topic.indexOf(this._opts.wildcardOne) >= 0) ||
         (topic.indexOf(this._opts.wildcardSome) >= 0);
}

module.exports = MQEmitterRedis
