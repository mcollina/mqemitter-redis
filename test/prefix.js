'use strict'

const redis = require('../')
const test = require('tape').test
const abstractTests = require('mqemitter/abstractTest.js')

abstractTests({
  builder: function (opts) { return new redis.MQEmitterRedisPrefix('some_prefix/', opts) },
  test
})
