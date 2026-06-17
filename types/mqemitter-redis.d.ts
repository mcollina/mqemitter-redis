import type { RedisOptions } from 'ioredis'
import type { MQEmitter } from 'mqemitter'

declare namespace MQEmitterRedis {
  export interface MQEmitterOptions {
    concurrency?: number;
    matchEmptyLevels?: boolean;
    separator?: string;
    wildcardOne?: string;
    wildcardSome?: string;
    connectionString?: string;
  }

  export interface LRUCacheOptions {
    ttlLRUCache?: number;// Time to live for the LRU cache in milliseconds
    maxLRUCache?: number;// Maximum number of items in the LRU cache
  }

  export type Message = Record<string, any> & { topic: string }

  export interface MQEmitterRedis extends MQEmitter {
    new (options?: MQEmitterOptions & RedisOptions & LRUCacheOptions): MQEmitterRedis;
    current: number;
    concurrent: number;
    on(
      topic: string,
      listener: (message: Message, done: () => void) => void,
      callback?: () => void
    ): this;
    emit(message: Message, callback?: (error?: Error) => void): void;
    removeListener(
      topic: string,
      listener: (message: Message, done: () => void) => void,
      callback?: () => void
    ): void;
    close(callback: () => void): void;
  }
}

declare function MQEmitterRedis (
  options?: MQEmitterRedis.MQEmitterOptions & RedisOptions & MQEmitterRedis.LRUCacheOptions
): MQEmitterRedis.MQEmitterRedis

export = MQEmitterRedis
