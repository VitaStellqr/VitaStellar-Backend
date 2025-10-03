import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAME } from './config';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const workQueue = new Queue(QUEUE_NAME, { connection });

export async function enqueueJob(name, payload) {
  await workQueue.add(name, payload, {
    attempts: Number(process.env.MAX_ATTEMPTS ?? 5),
    backoff: {
      type: 'exponential',
      delay: Number(process.env.BACKOFF_BASE_MS ?? 1000),
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
}
