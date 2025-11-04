import { parentPort, workerData } from "worker_threads";
import { Job } from ".";

function doJob(id: string, arr: Job[]): void {
  const job = findJob(id, arr);
  let message = "";

  if (job === null) {
    message = "couldn't find a job";
    return;
  }

  job.jobStatus = "processing";

  setTimeout(() => {
    console.log("processing job");
  }, 1000);

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
