import { parentPort, workerData, threadId } from "worker_threads";
import type { Job } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logEvent(event: string, jobId?: string) {
  const time = new Date().toISOString();
  console.log(
    `[${time}] [Thread ${threadId}] [Job ${jobId ?? "none"}] ${event}`
  );
}

async function doJob(job: Job): Promise<string> {
  logEvent(`job recieved: ${job.jobId}`);

  if (!job) {
    logEvent("no job found");
    return "couldn't find a job";
  }

  job.jobStatus = "processing";
  logEvent("job status: processing", job.jobId);

  await delay(Math.random() * 20000);

  job.jobStatus = "done";
  logEvent("job status: done", job.jobId);
  return "job well done";
}

(async () => {
  const result = await doJob(workerData.job);
  parentPort?.postMessage(result);
})();
