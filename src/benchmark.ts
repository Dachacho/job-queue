import axios from "axios";

const JOB_COUNT = 100;
const JOBS = Array.from({ length: JOB_COUNT }, (_, i) => ({
  type: "email",
  data: { to: `user${i}@example.com`, body: `Hello ${i}!` },
  priority: Math.floor(Math.random() * 5) + 1,
}));

async function submitJobs() {
  const start = Date.now();
  const res = await axios.post("http://localhost:3000/jobs", JOBS);
  const jobIds = res.data.jobIds;
  console.log(`Submitted ${jobIds.length} jobs in ${Date.now() - start}ms`);
  return jobIds;
}

async function pollJobs(jobIds: string[]) {
  const start = Date.now();
  let done = 0;
  let failed = 0;
  const statuses: Record<string, string> = {};

  while (done + failed < jobIds.length) {
    await Promise.all(
      jobIds.map(async (id) => {
        if (statuses[id]) return;
        try {
          const res = await axios.get(`http://localhost:3000/jobs/${id}`);
          const status = res.data;
          if (status === "done" || status === "failed") {
            statuses[id] = status;
          }
        } catch {
          // ignore errors
        }
      })
    );
    done = Object.values(statuses).filter((s) => s === "done").length;
    failed = Object.values(statuses).filter((s) => s === "failed").length;
    process.stdout.write(`\rProcessed: ${done + failed}/${jobIds.length}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  const elapsed = (Date.now() - start) / 1000;
  console.log(`\nAll jobs processed in ${elapsed.toFixed(2)}s`);
  console.log(`Jobs per second: ${(jobIds.length / elapsed).toFixed(2)}`);
}

(async () => {
  const jobIds = await submitJobs();
  await pollJobs(jobIds);
})();
