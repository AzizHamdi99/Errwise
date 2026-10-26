import { eventSchema } from "@errwise/shared";
import { describe, expect, it } from "vitest";
import type { ResolvedConfig } from "../src/config";
import { buildEvent } from "../src/event";

const config: ResolvedConfig = {
  apiKey: `ew_live_${"a".repeat(32)}`,
  eventsUrl: "http://localhost:4000/v1/events",
  environment: "production",
  release: "1.0.0",
  enabled: true,
  debug: false,
  beforeSend: undefined,
};

const hugeError = new Error("m".repeat(10_000));
hugeError.stack = "s".repeat(100_000);

const cases: Array<[string, unknown, Parameters<typeof buildEvent>[2]]> = [
  ["an Error", new TypeError("boom"), {}],
  [
    "an Error with extra data",
    new Error("x"),
    { extra: { userId: 1, tags: ["a"] } },
  ],
  ["a string", "oops", {}],
  ["undefined", undefined, {}],
  ["an object", { code: "E1" }, { level: "warning" }],
  ["an oversized Error", hugeError, { extra: { blob: "x".repeat(20_000) } }],
];

describe("SDK events match the API schema", () => {
  it.each(cases)("%s", (_name, input, options) => {
    const result = eventSchema.safeParse(buildEvent(input, config, options));
    expect(result.error?.issues ?? []).toEqual([]);
  });
});
