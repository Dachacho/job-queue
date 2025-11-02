import express from "express";

const app = express();
const port = 3000;

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/", (_req, res) => {
  res.send("Hello from server");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
