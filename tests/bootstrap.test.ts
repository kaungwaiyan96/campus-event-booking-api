import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { startServer } from '../src/bootstrap';

test('runtime secrets load before the Express application module', async () => {
  const calls: string[] = [];
  const fakeServer = new EventEmitter() as any;
  fakeServer.close = () => undefined;

  await startServer({
    port: 0,
    initializeSecrets: async () => { calls.push('secrets'); },
    loadApp: async () => {
      calls.push('app');
      return {
        default: {
          listen: (_port: number, callback: () => void) => {
            callback();
            return fakeServer;
          },
        } as any,
      };
    },
    log: () => undefined,
  });

  assert.deepEqual(calls, ['secrets', 'app']);
});
