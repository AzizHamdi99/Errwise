import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ErrwiseEvent } from "../src";
import { startFakeServer } from "./fake-server";
import type { FakeServer } from "./fake-server";

const FIXTURE = fileURLToPath(
  new URL("./fixtures/shared-state.cjs", import.meta.url),
);
let server: FakeServer;

beforeEach(async () => {
  server = await startFakeServer();
});
afterEach(async () => {
  await server.close();
});

function run() {
  return new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, [FIXTURE], {
      env: {
        ...process.env,
        ERRWISE_KEY: `ew_live_${"a".repeat(32)}`,
        ERRWISE_ENDPOINT: server.url,
      },
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", resolve);
  });
}

describe("built package (CommonJS)", () => {
  it("shares one client between the main entry and the nestjs entry", async () => {
    expect(await run()).toBe(0);

    const events = server.received.flatMap((r) => r.body as ErrwiseEvent[]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      message: "through the nest bundle",
      context: { request: { method: "GET", path: "/shared" } },
    });
  });
});
