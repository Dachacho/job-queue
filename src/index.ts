import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import type { Job } from "./types";
//THIS 2 ARE DUMB IMPORTS CAUSE FUCK TS AND NODE
import { fileURLToPath } from "url";
import path from "path";
import { Pool } from "pg";

export const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "jobqueue",
  password: "jobqueuepass",
  database: "jobqueue",
  max: 20,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 10000,
  application_name: "job-queue",
});

import { WorkerPool } from "./worker_pool.ts";
//THIS 2 IS A SHIT LINE BECAUSE FUCK TS AND NODE
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workerPool = new WorkerPool(path.resolve(__dirname, "worker.ts"), 3);
await workerPool.initialize();

const app = express();
const port = 3000;

app.use(express.json());

app.post("/jobs", async (req: Request, res: Response) => {
  try {
    const jobs = Array.isArray(req.body) ? req.body : [req.body];
    const addedJobs: string[] = [];

    for (const jobData of jobs) {
      const { type, data, priority } = jobData;
      let defaultPriority = -1;

      if (!type || !data) {
        return res.status(400).json({ message: "fields mising" });
      }

      if (priority) {
        defaultPriority = priority;
      }

      const id = randomUUID();

      let job: Job = {
        jobId: id,
        jobStatus: "waiting",
        jobType: type,
        jobData: data,
        jobPriority: defaultPriority,
        retryCount: 0,
        createdAt: Date.now(),
      };

      await workerPool.addJob(job);
      addedJobs.push(job.jobId);
    }

    // console.log(jobQueue);
    return res.status(201).json({ jobIds: addedJobs, message: "Jobs added" });
  } catch (err) {
    console.log("error", err);
    return res.json({ message: (err as Error).message });
  }
});

app.get("/jobs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let { rows } = await pool.query(
      `SELECT job_status FROM jobs WHERE job_id = $1`,
      [id]
    );

    if (rows.length) {
      return res.json(rows[0].job_status);
    } else {
      return res.status(404).json({ message: "not found" });
    }
  } catch (err) {
    console.log("error", err);
    return res.json({ message: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
