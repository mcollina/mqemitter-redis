'use strict'

const redis = require('../')
const { test } = require('node:test')
const abstractTests = require('mqemitter/abstractTest.js')

abstractTests({
  builder: redis,
  packetsInOrder: false,
  test
})
