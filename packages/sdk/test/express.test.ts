import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Errwise } from "../src";
import type { ErrwiseEvent } from "../src";
import { createExpressErrorHandler } from "../src/integrations/express";
import type { ExpressHandlerOptions } from "../src/integrations/express";
import { startFakeServer } from "./fake-server";
import type { FakeServer } from "./fake-server";

const API_KEY = `ew_live_${"a".repeat(32)}`;
let server: FakeServer;

beforeEach(async () => {
  server = await startFakeServer();
  Errwise.init({
    apiKey: API_KEY,
    endpoint: server.url,
    environment: "test",
    captureUncaughtErrors: false,
  });
});
afterEach(async () => {
  await Errwise.close(100);
  await server.close();
});

const sentEvents = () =>
  server.received.flatMap((r) => r.body as ErrwiseEvent[]);

function buildApp(options?: ExpressHandlerOptions) {
  const app = express();
  app.get("/ok", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/boom", () => {
    throw new TypeError("boom");
  });
  app.get("/async-boom", async () => {
    await Promise.resolve();
    throw new Error("async boom");
  });
  app.get("/missing", (_req, _res, next) => {
    next(Object.assign(new Error("no such user"), { status: 404 }));
  });

  app.use(Errwise.expressErrorHandler(options));
  // the app's own error handler must still run after ours
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const status = (error as { status?: number }).status ?? 500;
      res.status(status).json({ handledByApp: true });
    },
  );
  return app;
}

describe("expressErrorHandler", () => {
  it("has four parameters, which is how Express recognizes an error handler", () => {
    expect(Errwise.expressErrorHandler()).toHaveLength(4);
  });

  it("reports a thrown error with the method and path, without the query string", async () => {
    const res = await request(buildApp()).get("/boom?token=secret").expect(500);
    expect(res.body).toEqual({ handledByApp: true });

    await Errwise.flush();
    expect(sentEvents()).toHaveLength(1);
    expect(sentEvents()[0]).toMatchObject({
      type: "TypeError",
      message: "boom",
      level: "error",
      context: {
        request: { method: "GET", path: "/boom" },
        extra: { mechanism: "express" },
      },
    });
    expect(JSON.stringify(sentEvents())).not.toContain("secret");
  });

  it("reports an error thrown by an async handler (Express 5)", async () => {
    await request(buildApp()).get("/async-boom").expect(500);
    await Errwise.flush();
    expect(sentEvents()[0]?.message).toBe("async boom");
  });

  it("does not report 4xx errors, but the app still answers", async () => {
    await request(buildApp()).get("/missing").expect(404);
    await request(buildApp()).get("/ok").expect(200);
    await Errwise.flush();
    expect(server.received).toHaveLength(0);
  });

  it("lets shouldCapture decide", async () => {
    await request(buildApp({ shouldCapture: () => true }))
      .get("/missing")
      .expect(404);
    await Errwise.flush();
    expect(sentEvents()[0]?.message).toBe("no such user");
  });

  it("never breaks the error chain, even if reporting fails", () => {
    const next = vi.fn();
    const handler = createExpressErrorHandler(() => {
      throw new Error("bug in the SDK");
    });
    const error = new Error("x");

    expect(() => handler(error, {}, {}, next)).not.toThrow();
    expect(next).toHaveBeenCalledWith(error);
  });
});
