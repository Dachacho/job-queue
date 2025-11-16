# JOB QUEUE

i wanted to dive into job queues and messaging systems so what better way to learn then to build one out yourself.

---

# FEATURES:

- Queue System for the jobs.
- WorkerPool (multiple threads doing jobs)
- PostgreSQL for presistent DB of jobs
- Redis for main computation and speed

# MAIN FLOW:

jobs _(as an array could be one)_ get sent on `/jobs` endpoint, then it gets put in inserted into DB and pushed in redis. from redis we pop first job, it gets processed and status _(failed or done)_ get sent to DB. so DB stands for source of truth and redis is just for fast access. on every intialization jobs that were stuck on processing _(or retrying)_ get reset so they can still work.

# FEATURES TO BE ADDED:

- job scheduling
- exponential retrying times
- better load handling
- better logging
- endpoints for metrics/health
- tests
- refactor code so its cleaner
- _(stuff i cant't think of but probably is going to be added if i do finish this project)_

---

fun project give it a try if you want to dive deeper into threading.
