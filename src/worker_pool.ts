import { Worker } from "node:worker_threads";
import type { Job } from "./types.ts";
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
        `UPDATE jobs SET job_status = 'waiting' WHERE job_status = 'processing'`
      )
      .then(() => {
        console.log("Reset stuck jobs to waiting");
      });

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerPath);
      this.workers.push(worker);
      this.idleWorkers.push(worker);

      worker.on("message", async (result) => {
        const jobId = this.workerJobMap.get(worker);
        console.log(
          `[WorkerPool] Worker ${worker.threadId} finished job, result: ${result}`
        );

        if (jobId) {
          await pool.query(
            `UPDATE jobs SET job_status = 'done' WHERE job_id = $1`,
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
}
