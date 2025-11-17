# JOB QUEUE

I wanted to dive into job queues _(and node threads)_ so what better way to learn then to build one out yourself.

---

# FEATURES:

- Queue System for the jobs.
- WorkerPool (multiple threads doing jobs)
- PostgreSQL for presistent DB of jobs
- Redis for main computation and speed
- `benchmark.ts` file for running benchmarks to test how fast it runs

## Performance

- ~400 jobs/sec sustained (8 workers, 10ms jobs)
- Handles 10k+ jobs reliably
- zero job loss on crashes (everything is recovered)

# MAIN FLOW:

jobs _(as an array could be one)_ get sent on `/jobs` endpoint, then it gets put in inserted into DB and pushed in redis. from redis we pop first job, it gets processed and status _(failed or done)_ get sent to DB. so DB stands for source of truth and redis is just for fast access. on every intialization jobs that were stuck on processing _(or retrying)_ get reset so they can still work.

### architechture:

```
Client → POST /jobs
    ↓
PostgreSQL (persist) + Redis (queue)
    ↓
Workers (BRPOP from Redis)
    ↓
Process job
    ↓
Update PostgreSQL (completed/failed)
```

# FEATURES TO BE ADDED:

- job scheduling
- exponential retrying times
- refactor code so its cleaner _(very much a non issue for this scale)_

# Installation

```bash
npm install
# Start PostgreSQL and Redis (Docker)
docker-compose up -d
# Start workers
npm run dev
# To run benchmark after running your server run
npx ts-node src/benchmark.ts
```

then `POST` your jobs to `/jobs` to run it.

_check `package.json` for all the scripts_

---

fun project give it a try if you want to dive deeper into threading.
