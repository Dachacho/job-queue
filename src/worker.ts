import { parentPort, workerData, threadId } from "worker_threads";
import type { Job } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logEvent(event: string, jobId?: string) {
  const time = new Date().toISOString();
  console.log(
    `[${time}] [Thread ${threadId}] [Job ${jobId ?? "none"}] ${event}`
  );
}

parentPort?.on("message", async (job: Job) => {
  const id = job.job_id ?? job.jobId;
  logEvent(`job recieved: ${id}`);

  if (!job) {
    logEvent("no job found");
    parentPort?.postMessage("couldn't find a job");
    return;
  }

  logEvent("job status: processing", id);

  //fake work
  await delay(10);
  if (job.jobData !== undefined) {
    JSON.stringify(job.jobData);
    JSON.parse(JSON.stringify(job.jobData));
  }

  //commented out to check benchmarks
  //   if (Math.random() < 0.6) {
  //     logEvent("job status: failed", id);
  //     parentPort?.postMessage({ job_id: id, status: "failed" });
  //   } else {
  logEvent("job status: done", id);
  parentPort?.postMessage({ job_id: id, status: "done" });
  //   }
});
