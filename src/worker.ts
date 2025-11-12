import { parentPort, workerData, threadId } from "worker_threads";
import type { Job } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logEvent(event: string, jobId?: string) {
  const time = new Date().toISOString();
  console.log(
    `[${time}] [Thread ${threadId}] [Job ${jobId ?? "none"}] ${event}`
  );
}

// async function doJob(job: Job): Promise<string> {
parentPort?.on("message", async (job: Job) => {
  logEvent(`job recieved: ${job.jobId}`);

  if (!job) {
    logEvent("no job found");
    parentPort?.postMessage("couldn't find a job");
    return;
  }

  job.jobStatus = "processing";
  logEvent("job status: processing", job.jobId);

  await delay(Math.random() * 20000);

  job.jobStatus = "done";
  logEvent("job status: done", job.jobId);
  parentPort?.postMessage("job well done");
});

// (async () => {
//   const result = await doJob(workerData.job);
//   parentPort?.postMessage(result);
// })();
