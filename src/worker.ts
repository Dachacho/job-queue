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
  const id = job.job_id ?? job.jobId;
  logEvent(`job recieved: ${id}`);

  if (!job) {
    logEvent("no job found");
    parentPort?.postMessage("couldn't find a job");
    return;
  }

  logEvent("job status: processing", job.job_id);

  await delay(Math.random() * 20000);

  //   if (Math.random() < 0.3) {
  //     logEvent("job status: done", job.job_id);
  //     parentPort?.postMessage("job well done");
  //   } else {
  logEvent("job status: done", job.job_id);
  parentPort?.postMessage({ job_id: job.job_id, status: "done" });
  //   }
});

// (async () => {
//   const result = await doJob(workerData.job);
//   parentPort?.postMessage(result);
// })();
// add retry logic
