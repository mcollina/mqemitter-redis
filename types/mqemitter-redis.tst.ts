import { describe, expect, it } from 'tstyche'
import mqEmitterRedis, { Message, MQEmitterRedis } from './mqemitter-redis.js'

describe('MQEmitterRedis', () => {
  describe('constructor', () => {
    it('returns MQEmitterRedis with no options', () => {
      expect(mqEmitterRedis()).type.toBe<MQEmitterRedis>()
    })

    it('returns MQEmitterRedis with simple options', () => {
      expect(
        mqEmitterRedis({ concurrency: 200, matchEmptyLevels: true })
      ).type.toBe<MQEmitterRedis>()
    })

    it('returns MQEmitterRedis with full options', () => {
      expect(
        mqEmitterRedis({
          concurrency: 10,
          matchEmptyLevels: true,
          separator: '/',
          wildcardOne: '+',
          wildcardSome: '#',
          connectionString: 'redis://:authpassword@127.0.0.1:6380/4',
        })
      ).type.toBe<MQEmitterRedis>()
    })

    it('returns MQEmitterRedis with ioredis options', () => {
      expect(
        mqEmitterRedis({
          concurrency: 10,
          matchEmptyLevels: true,
          host: 'localhost',
          port: 6379,
          reconnectOnError: (_error: Error) => true,
          retryStrategy: (times: number) => times * 1.5,
        })
      ).type.toBe<MQEmitterRedis>()
    })

    it('returns MQEmitterRedis with LRU cache options', () => {
      expect(
        mqEmitterRedis({
          maxLRUCache: 100,
          ttlLRUCache: 10000,
        })
      ).type.toBe<MQEmitterRedis>()
    })
  })

  describe('methods', () => {
    function listener (_message: Message, _done: () => void) {}

    it('on returns the instance', () => {
      expect(mqEmitterRedis().on('topic', listener)).type.toBe<MQEmitterRedis>()
    })

    it('removeListener returns void', () => {
      expect(
        mqEmitterRedis().removeListener('topic', listener)
      ).type.toBe<void>()
    })

    it('emit rejects null', () => {
      expect(mqEmitterRedis().emit).type.not.toBeCallableWith(null)
    })

    it('emit returns void', () => {
      expect(
        mqEmitterRedis().emit({ topic: 'test', prop1: 'prop1' })
      ).type.toBe<void>()
    })

    it('close returns void', () => {
      expect(mqEmitterRedis().close(() => null)).type.toBe<void>()
    })
  })
})
