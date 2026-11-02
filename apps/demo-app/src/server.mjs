import express from "express";
import { Errwise } from "@errwise/node";

const apiKey = process.env.ERRWISE_API_KEY;
if (!apiKey) {
  console.error("Set ERRWISE_API_KEY first (create a key in the dashboard).");
  process.exit(1);
}

Errwise.init({
  apiKey,
  endpoint: process.env.ERRWISE_ENDPOINT ?? "http://localhost:4000",
  environment: "demo",
  release: "1.0.0",
  debug: true,
});

const app = express();
const port = Number(process.env.PORT ?? 5000);

app.get("/", (_req, res) => {
  res.json({
    routes: [
      "/ok",
      "/boom",
      "/type-error",
      "/async-boom",
      "/users/1, /users/2, /users/3",
      "/bad-request",
      "/crash",
    ],
  });
});

app.get("/ok", (_req, res) => {
  res.json({ ok: true });
});

// a plain thrown error
app.get("/boom", () => {
  throw new Error("Something went wrong in /boom");
});

// a real TypeError: "Cannot read properties of undefined (reading 'name')"
app.get("/type-error", () => {
  const user = undefined;
  return user.name;
});

// Express 5 forwards a rejected promise to the error handlers
app.get("/async-boom", async () => {
  await Promise.resolve();
  throw new Error("Async failure in /async-boom");
});

// the messages differ only by a number, so they group into ONE issue
app.get("/users/:id", (req) => {
  throw new Error(`User ${req.params.id} not found`);
});

// a client error: it must NOT become an issue
app.get("/bad-request", (_req, _res, next) => {
  next(Object.assign(new Error("Invalid input"), { status: 400 }));
});

// an uncaught exception outside Express: reported as "fatal", then the process exits with code 1
app.get("/crash", (_req, res) => {
  res.json({ crashing: true });
  setTimeout(() => {
    throw new Error("Crash on purpose from /crash");
  }, 50);
});

// after the routes, before your own error handler
app.use(Errwise.expressErrorHandler());

app.use((error, _req, res, _next) => {
  const status = error.status ?? 500;
  res.status(status).json({
    error: status < 500 ? error.message : "Internal server error",
  });
});

const httpServer = app.listen(port, () => {
  console.log(`Demo app on http://localhost:${port}`);
});

// flush on shutdown so queued errors are not lost
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    httpServer.close();
    void Errwise.close().then(() => process.exit(0));
  });
}
