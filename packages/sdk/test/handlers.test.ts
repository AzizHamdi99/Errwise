import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ErrwiseEvent } from "../src";
import { startFakeServer } from "./fake-server";
import type { FakeServer } from "./fake-server";

const FIXTURE = fileURLToPath(new URL("./fixtures/child.mjs", import.meta.url));
const API_KEY = `ew_live_${"a".repeat(32)}`;
let server: FakeServer;

beforeEach(async () => {
  server = await startFakeServer();
});
afterEach(async () => {
  await server.close();
});

function run(mode: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(process.execPath, [FIXTURE], {
        env: {
          ...process.env,
          MODE: mode,
          ERRWISE_KEY: API_KEY,
          ERRWISE_ENDPOINT: server.url,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += String(chunk)));
      child.stderr.on("data", (chunk) => (stderr += String(chunk)));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    },
  );
}

const sentEvents = () =>
  server.received.flatMap((r) => r.body as ErrwiseEvent[]);

describe("process hooks", () => {
  it("reports an uncaught exception, then exits with code 1", async () => {
    const { code, stderr } = await run("uncaught");

    expect(code).toBe(1);
    expect(stderr).toContain("crashed on purpose");
    expect(sentEvents()).toHaveLength(1);
    expect(sentEvents()[0]).toMatchObject({
      type: "TypeError",
      message: "crashed on purpose",
      level: "fatal",
      context: { extra: { mechanism: "uncaughtException" } },
    });
  });

  it("reports an unhandled rejection, then exits with code 1", async () => {
    const { code } = await run("rejection");

    expect(code).toBe(1);
    expect(sentEvents()[0]).toMatchObject({
      type: "RangeError",
      message: "rejected on purpose",
      level: "fatal",
      context: { extra: { mechanism: "unhandledRejection" } },
    });
  });

  it("only reports when the app handles the exception itself", async () => {
    const { code, stdout } = await run("handled");

    expect(code).toBe(0);
    expect(stdout).toContain("handled by the app");
    expect(sentEvents()[0]).toMatchObject({
      message: "error handled by the app",
      level: "error",
    });
  });

  it("sends what is queued when the script ends without flush", async () => {
    const { code } = await run("before-exit");

    expect(code).toBe(0);
    expect(sentEvents()[0]?.message).toBe("left in the queue");
  });
});
