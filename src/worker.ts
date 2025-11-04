import { parentPort, workerData } from "worker_threads";
import type { Job } from "./types";

function doJob(id: string, arr: Job[]): void {
  let message = "";

  if (!id || !arr) {
    message = "no id or arr";
  }

  const job = findJob(id, arr);

  if (job === null) {
    message = "couldn't find a job";
    return;
  }

  job.jobStatus = "processing";

  setTimeout(() => {
    console.log("processing job");
  }, 3000);

  job.jobStatus = "done";
  message = "job well done";
}

function findJob(id: string, arr: Job[]): Job | null {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].jobId === id) {
      return arr[i];
    }
  }
  return null;
}

const result = doJob(workerData.id, workerData.queue);
parentPort?.postMessage(result);
