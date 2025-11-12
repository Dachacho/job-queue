import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { Worker } from "worker_threads";
import type { Job } from "./types";
//THIS 2 ARE DUMB IMPORTS CAUSE FUCK TS AND NODE
import { fileURLToPath } from "url";
import path from "path";
//THIS 2 IS A SHIT LINE BECAUSE FUCK TS AND NODE
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

const jobQueue: Job[] = [];

async function runWorker() {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, "worker.ts"), {
      workerData: {
        job: jobQueue.pop(),
      },
    });

    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0)
        reject(new Error(`Worker stopped with exit code ${code}`));
      console.log(
        `[${new Date().toISOString()}] Worker exited with code ${code}`
      );
    });
  });
}

setInterval(() => {
  console.log("queue state: ", jobQueue.length);
  if (jobQueue.length > 0) {
    for (let i = 0; i < 5; i++) {
      (async () => {
        await runWorker();
      })();
    }
  }
}, 2000);

app.post("/jobs", (req: Request, res: Response) => {
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
        createdAt: Date.now(),
      };

      jobQueue.push(job);
      addedJobs.push(id);
    }

    // console.log(jobQueue);
    return res.status(201).json({ jobIds: addedJobs, message: "Jobs added" });
  } catch (err) {
    console.log("error", err);
    return res.json({ message: (err as Error).message });
  }
});

app.get("/jobs/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let job: Job;

    for (let i = 0; i < jobQueue.length; i++) {
      if (jobQueue[i].jobId === id) {
        job = jobQueue[i];
        return res.json(job.jobStatus);
      }
    }
  } catch (err) {
    console.log("error", err);
    return res.json({ message: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
