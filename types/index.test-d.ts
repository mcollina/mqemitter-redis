import { expectError, expectType } from 'tsd';
import mqEmitterRedis, { MQEmitterRedis } from '.';

expectType<MQEmitterRedis>(mqEmitterRedis());

expectType<MQEmitterRedis>(
  mqEmitterRedis({ concurrency: 200, matchEmptyLevels: true })
);

expectType<MQEmitterRedis>(mqEmitterRedis().on('topic', (message, cb) => {}));

expectError(mqEmitterRedis().emit(null));

expectType<void>(mqEmitterRedis().emit({ topic: 'test', prop1: 'prop1' }));

expectType<void>(mqEmitterRedis().close(() => null));
