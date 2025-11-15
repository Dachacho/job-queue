import { Worker } from "node:worker_threads";
import { MAX_RETRY, type Job } from "./types.ts";
import { pool } from "./index.ts";

export class WorkerPool {
  private workerPath: string;
  private poolSize: number;
  private workers: Worker[];
  private idleWorkers: Worker[];
  private workerJobMap: Map<Worker, string>;
  constructor(workerPath: string, poolSize = 3) {
    this.workerPath = workerPath;
    this.poolSize = poolSize;
    this.workers = [];
    this.idleWorkers = [];
    this.workerJobMap = new Map<Worker, string>();

    pool
      .query(
        `UPDATE jobs SET job_status = 'waiting' WHERE job_status = 'processing' OR job_status = 'failed' OR job_status = 'failed'`
      )
      .then(() => {
        console.log("Reset stuck jobs to waiting");
      });

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerPath);
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
          await pool.query(
            `UPDATE jobs SET job_status = 'done' WHERE job_id = $1`,
            [jobId]
          );
        }

        if (jobId && status === "failed") {
          await pool.query(
            `UPDATE jobs SET job_status = 'failed' WHERE job_id = $1`,
            [jobId]
          );
        }
        this.workerJobMap.delete(worker);

        this.idleWorkers.push(worker);
        this.assignJobs();
      });

      worker.on("error", (err) => {
        console.error(`[Worker ${worker.threadId}] Error:`, err);
      });

      worker.on("exit", () => {});
    }

    setInterval(() => {
      this.assignJobs();
      this.retryJobs();
    }, 3000);
  }

  async addJob(job: Job) {
    console.log(`[WorkerPool] Queuing job: ${job.jobId}`);
    await pool.query(
      `INSERT INTO jobs (job_id, job_status, job_type, job_data, job_priority, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        job.jobId,
        job.jobStatus,
        job.jobType,
        job.jobData,
        job.jobPriority,
        job.createdAt,
      ]
    );
  }

  private async assignJobs() {
    while (this.idleWorkers.length > 0) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          `SELECT * FROM jobs WHERE job_status = 'waiting' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
        );

        if (rows.length === 0) {
          console.log("NO WORK FOUND");
          break;
        }
        const job = rows[0];
        await client.query(
          `UPDATE jobs SET job_status = 'processing' WHERE job_id = $1`,
          [job.job_id]
        );
        const worker = this.idleWorkers.shift();
        this.workerJobMap.set(worker!, job.job_id);
        console.log(
          `[WorkerPool] Assigning job ${job?.job_id} to worker ${worker?.threadId}`
        );
        worker?.postMessage(job);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        throw err;
      } finally {
        client.release();
      }
    }
  }

  private async retryJobs() {
    while (this.idleWorkers.length > 0) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const { rows: unretriable } = await client.query(
          `SELECT * FROM jobs WHERE job_status = 'failed' AND retry_count > $1`,
          [MAX_RETRY]
        );

        if (unretriable.length > 0) {
          unretriable.forEach((job) => {
            console.log(
              `[WorkerPool] Job ${job.job_id} exceeded max retries and will not be retried`
            );
          });

          await client.query(
            `DELETE FROM jobs WHERE job_status = 'failed' and retry_count > $1`,
            [MAX_RETRY]
          );
        }

        const { rows } = await client.query(
          `SELECT * FROM jobs WHERE job_status = 'failed' AND retry_count <= $1 ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [MAX_RETRY]
        );

        if (rows.length === 0) {
          console.log("NO RETRIABLE JOBS");
          await client.query("COMMIT");
          break;
        }
        const job = rows[0];
        await client.query(
          `UPDATE jobs SET job_status = 'retrying', retry_count = retry_count + 1 WHERE job_id = $1`,
          [job.job_id]
        );
        const worker = this.idleWorkers.shift();
        this.workerJobMap.set(worker!, job.job_id);
        console.log(
          `[WorkerPool] Assigning job ${job?.job_id} to worker ${worker?.threadId}`
        );
        worker?.postMessage(job);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        // client.release();
        throw err;
      } finally {
        client.release();
      }
    }
  }
}
