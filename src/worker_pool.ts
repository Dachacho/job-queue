import { Worker } from "node:worker_threads";
import type { Job } from "./types.ts";

export class WorkerPool {
  private workerPath: string;
  private poolSize: number;
  private workers: Worker[];
  private taskQueue: Job[];
  private idleWorkers: Worker[];
  constructor(workerPath: string, poolSize = 3) {
    this.workerPath = workerPath;
    this.poolSize = poolSize;
    this.workers = [];
    this.taskQueue = [];
    this.idleWorkers = [];

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerPath);
      this.workers.push(worker);
      this.idleWorkers.push(worker);

      worker.on("message", (result) => {
        console.log(
          `[WorkerPool] Worker ${worker.threadId} finished job, result: ${result}`
        );
        this.idleWorkers.push(worker);
        this.assignJobs();
      });

      worker.on("error", (err) => {
        console.error(`[Worker ${worker.threadId}] Error:`, err);
      });

      worker.on("exit", () => {});
    }
  }

  addJob(job: Job) {
    console.log(`[WorkerPool] Queuing job: ${job.jobId}`);
    this.taskQueue.push(job);
    this.assignJobs();
  }

  private assignJobs() {
    while (this.taskQueue.length > 0 && this.idleWorkers.length > 0) {
      const job = this.taskQueue.shift();
      const worker = this.idleWorkers.shift();
      console.log(
        `[WorkerPool] Assigning job ${job?.jobId} to worker ${worker?.threadId}`
      );
      worker?.postMessage(job);
    }
  }
}
