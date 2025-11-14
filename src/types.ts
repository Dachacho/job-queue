export interface Job {
  jobId: string;
  job_id?: string; // for postgres
  jobStatus: string;
  jobType: string;
  jobData: string;
  jobPriority: number;
  createdAt: number;
}
