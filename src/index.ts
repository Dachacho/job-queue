import express from "express";
import { Request, Response } from "express";
import { randomUUID } from "crypto";

const app = express();
const port = 3000;

app.use(express.json());

export interface Job {
  jobId: string;
  jobStatus: string;
  jobType: string;
  jobData: string;
  jobPriority: number;
}

const queue: Job[] = [];

app.post("/jobs", (req: Request, res: Response) => {
  try {
    const { type, data, priority } = req.body;
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
    };

    queue.push(job);

    console.log(queue);
  } catch (err) {
    console.log("error", err);
    return res.json({ message: (err as Error).message });
  }
});

app.get("/jobs/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let job: Job;

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].jobId === id) {
        job = queue[i];
        return res.json(job);
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
