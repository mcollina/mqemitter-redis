'use strict'

const redis = require('../')
const test = require('tape').test
const abstractTests = require('mqemitter/abstractTest.js')

abstractTests({
  builder: redis,
  packetsInOrder: false,
  test
})
