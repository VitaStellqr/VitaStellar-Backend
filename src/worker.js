import { Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Pool } from 'pg';
import { QUEUE_NAME, MAX_ATTEMPTS, BACKOFF_BASE_MS } from './config';
import { saveDLQItem } from './dlqStore';
import promClient from 'prom-client';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
const pg = new Pool({ connectionString: process.env.DATABASE_URL });

const worker = new Worker(QUEUE_NAME, async (job) => {
  // Your job handler (example)
  const { data } = job;
  // perform job; throw on error to trigger retries
  await doWork(data);
}, { connection: redis, concurrency: 5 });

const qEvents = new QueueEvents(QUEUE_NAME, { connection: redis });

// Metrics
const dlqGauge = new promClient.Gauge({ name: 'dlq_size', help: 'Number of items in DLQ' });
const dlqAddedCounter = new promClient.Counter({ name: 'dlq_add_total', help: 'DLQ items added' });

qEvents.on('failed', async ({ jobId, failedReason }) => {
  // inspect job using Worker API (Job is not directly available here)
  try {
    const job = await worker.getJob(jobId);
    if (!job) return;

    const attemptsMade = job.attemptsMade ?? 0;
    const optsAttempts = (job.opts && (job.opts).attempts) ?? MAX_ATTEMPTS;

    if (attemptsMade >= optsAttempts) {
      // move to DLQ storage
      await saveDLQItem(pg, {
        queue_name: QUEUE_NAME,
        job_id: job.id?.toString(),
        payload: job.data,
        attempts: attemptsMade,
        last_error: failedReason,
        metadata: {
          opts: job.opts,
          timestamp: new Date().toISOString()
        }
      });

      dlqAddedCounter.inc();
      // optionally remove job from failed set (Bull manages failed jobs)
      await job.remove();
      // update gauge (simple approach: query count)
      const res = await pg.query('SELECT count(*) FROM dlq_items');
      dlqGauge.set(Number(res.rows[0].count));
    }
  } catch (err) {
    console.error('Error handling failed job event', err);
  }
});

worker.on('error', err => console.error('Worker error', err));

async function doWork(data) {
  // Replace with actual work. For demo:
  if (Math.random() < 0.7) throw new Error('Transient error');
  return true;
}