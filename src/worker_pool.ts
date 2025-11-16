import { Worker } from "node:worker_threads";
import { redis, MAX_RETRY, type Job } from "./types.ts";
import { pool } from "./index.ts";

export class WorkerPool {
  private workerPath: string;
  private poolSize: number;
  private workers: Worker[];
  private idleWorkers: Worker[];
  private workerJobMap: Map<Worker, string>;
  constructor(workerPath: string, poolSize = 12) {
    this.workerPath = workerPath;
    this.poolSize = poolSize;
    this.workers = [];
    this.idleWorkers = [];
    this.workerJobMap = new Map<Worker, string>();

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerPath);
      this.setupWorker(worker);
    }
  }

  async addJob(job: Job) {
    console.log(`[WorkerPool] Queuing job: ${job.jobId ?? job.job_id}`);

    await pool.query(
      `INSERT INTO jobs (job_id, job_status, job_type, job_data, job_priority, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        job.jobId ?? job.job_id,
        job.jobStatus,
        job.jobType,
        job.jobData,
        job.jobPriority,
        job.createdAt,
      ]
    );

    await redis.lPush("job_queue", JSON.stringify(job));
  }

  private async assignJobs() {
    while (true) {
      if (this.idleWorkers.length === 0) {
        // to prevent busy looping (100 milliseconds to save some cpu) waiting for worker to become idle
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      const result = await redis.blPop(["job_queue", "retry_queue"], 1);
      if (!result) {
        console.log("NO WORK FOUND");
        continue;
      }

      // redis.blPop returns an object { key, element } (not an array)
      const { key: _queue, element: jobString } = result;
      const job: Job = JSON.parse(jobString);

      await pool.query(
        `UPDATE jobs SET job_status = 'processing' WHERE job_id = $1`,
        [job.jobId ?? job.job_id]
      );

      const worker = this.idleWorkers.shift();
      this.workerJobMap.set(worker!, job.jobId ?? job.job_id);
      console.log(
        `[WorkerPool] Assigning job ${job.jobId} to worker ${worker?.threadId}`
      );
      worker?.postMessage(job);
    }
  }

  private async retryJobs() {
    while (true) {
      if (this.idleWorkers.length === 0) {
        //same cpu saving here
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const { rows: unretriable } = await client.query(
          `SELECT * FROM jobs WHERE job_status = 'retrying' AND retry_count > $1`,
          [MAX_RETRY]
        );
        if (unretriable.length > 0) {
          unretriable.forEach((job) => {
            console.log(
              `[WorkerPool] Job ${job.job_id} exceeded max retries and will not be retried`
            );
          });
          await client.query(
            `UPDATE jobs SET job_status = 'failed' WHERE job_status = 'retrying' and retry_count > $1`,
            [MAX_RETRY]
          );
        }

        const { rows } = await client.query(
          `SELECT * FROM jobs WHERE job_status = 'retrying' AND retry_count <= $1 ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [MAX_RETRY]
        );
        if (rows.length === 0) {
          console.log("NO RETRIABLE JOBS");
          await client.query("COMMIT");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // sleep before next retry check
          continue;
        }

        const job = rows[0];
        await client.query(
          `UPDATE jobs SET job_status = 'retrying', retry_count = retry_count + 1 WHERE job_id = $1`,
          [job.job_id]
        );

        await redis.lPush("retry_queue", JSON.stringify(job));
        await client.query("COMMIT");
        console.log(`[WorkerPool] Retrying job ${job.job_id}`);
      } catch (err) {
        await client.query("ROLLBACK");
        // client.release();
        throw err;
      } finally {
        client.release();
      }
    }
  }

  async initialize() {
    redis
      .connect()
      .then(() => {
        console.log("redis connected");
      })
      .catch((err) => {
        console.error("redis connection error: ", err);
      });

    await pool.query(
      `UPDATE jobs SET job_status = 'waiting', retry_count = 0 WHERE job_status = 'processing' OR (job_status = 'retrying' AND retry_count <= $1)`,
      [MAX_RETRY]
    );

    const { rows: waitingJobs } = await pool.query(
      `SELECT * FROM jobs WHERE job_status = 'waiting'`
    );

    for (const job of waitingJobs) {
      await redis.lPush("job_queue", JSON.stringify(job));
    }
    console.log(
      `Reset stuck jobs to waiting and re-queued ${waitingJobs.length} jobs`
    );

    void this.assignJobs();
    void this.retryJobs();
  }

  private setupWorker(worker: Worker) {
    this.workers.push(worker);
    this.idleWorkers.push(worker);

    worker.on("message", async (result) => {
      const jobId = result.job_id ?? result.jobId;
      const status = result.status;
      // const jobId = result.job_id;
      console.log(
        `[WorkerPool] Worker ${
          worker.threadId
        } finished job, result: ${JSON.stringify(result)}`
      );

      if (jobId && status === "done") {
        const res = await pool.query(
          `UPDATE jobs SET job_status = 'done' WHERE job_id = $1`,
          [jobId]
        );

        console.log(
          `[WorkerPool] Updated to done: rowCount=${res.rowCount} for job_id=${jobId}`
        );
      }

      if (jobId && status === "failed") {
        const res = await pool.query(
          `UPDATE jobs SET job_status = 'failed' WHERE job_id = $1`,
          [jobId]
        );

        console.log(
          `[WorkerPool] Updated to failed: rowCount=${res.rowCount} for job_id=${jobId}`
        );
      }
      this.workerJobMap.delete(worker);

      this.idleWorkers.push(worker);
    });

    worker.on("error", async (err) => {
      console.error(`[Worker ${worker.threadId}] Error:`, err);
      const jobId = this.workerJobMap.get(worker);
      if (jobId) {
        await pool.query(
          `UPDATE jobs SET job_status = 'failed' WHERE job_id = $1`,
          [jobId]
        );
        this.workerJobMap.delete(worker);
      }
      this.removeWorker(worker);
      this.restartWorker();
    });

    worker.on("exit", async (code) => {
      console.error(`[Worker ${worker.threadId}] exited with code ${code}`);
      const jobId = this.workerJobMap.get(worker);
      if (jobId) {
        await pool.query(
          `UPDATE jobs SET job_status = 'failed' WHERE job_id = $1`,
          [jobId]
        );
        this.workerJobMap.delete(worker);
      }
      this.removeWorker(worker);
      this.restartWorker();
    });
  }

  private removeWorker(worker: Worker) {
    this.workers = this.workers.filter((w) => w !== worker);
    this.idleWorkers = this.idleWorkers.filter((w) => w !== worker);
  }

  private restartWorker() {
    const newWorker = new Worker(this.workerPath);
    this.setupWorker(newWorker);
  }
}
