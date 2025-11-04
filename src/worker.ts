import { parentPort, workerData } from "worker_threads";
import type { Job } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function doJob(job: Job): Promise<string> {
  console.log(`job: ${job}`);
  let message = "";

  if (!job) {
    message = "couldn't find a job";
    console.log("message from if: ", message);
    return message;
  }

  job.jobStatus = "processing";
  console.log("job status: ", job.jobStatus);

  await delay(3000);

  job.jobStatus = "done";
  console.log("job status: ", job.jobStatus);
  message = "job well done";

  console.log("message: ", message);

  return message;
}

(async () => {
  const result = await doJob(workerData.job);
  parentPort?.postMessage(result);
})();
