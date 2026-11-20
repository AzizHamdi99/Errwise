import { describe, expect, it } from "vitest";
import { normalizeCommitSha, resolveCommit } from "../src/commit";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("normalizeCommitSha", () => {
  it("accepts 7 to 64 hex characters and lowercases them", () => {
    expect(normalizeCommitSha(SHA)).toBe(SHA);
    expect(normalizeCommitSha("ABCDEF1")).toBe("abcdef1");
    expect(normalizeCommitSha(`  ${SHA}\n`)).toBe(SHA);
    expect(normalizeCommitSha("a".repeat(64))).toBe("a".repeat(64));
  });

  it("ignores anything else instead of throwing", () => {
    for (const bad of [
      "abc123", // too short
      "a".repeat(65), // too long
      "main",
      "v1.2.3",
      "g".repeat(40),
      "",
      "   ",
      null,
      undefined,
      42,
      {},
      ["abcdef1"],
    ]) {
      expect(normalizeCommitSha(bad)).toBeUndefined();
    }
  });
});

describe("resolveCommit", () => {
  it("prefers the explicit option over the environment", () => {
    expect(resolveCommit("abcdef1", { GITHUB_SHA: SHA })).toBe("abcdef1");
  });

  it("reads the variable of each supported platform", () => {
    for (const name of [
      "ERRWISE_COMMIT_SHA",
      "VERCEL_GIT_COMMIT_SHA",
      "GITHUB_SHA",
      "RENDER_GIT_COMMIT",
      "RAILWAY_GIT_COMMIT_SHA",
      "SOURCE_VERSION",
      "CF_PAGES_COMMIT_SHA",
    ]) {
      expect(resolveCommit(undefined, { [name]: SHA })).toBe(SHA);
    }
  });

  it("lets ERRWISE_COMMIT_SHA win over a platform variable", () => {
    expect(
      resolveCommit(undefined, {
        VERCEL_GIT_COMMIT_SHA: "1111111",
        ERRWISE_COMMIT_SHA: "2222222",
      }),
    ).toBe("2222222");
  });

  it("skips an invalid value and falls back to the next source", () => {
    expect(resolveCommit("not-a-sha", { GITHUB_SHA: SHA })).toBe(SHA);
    expect(
      resolveCommit(undefined, { ERRWISE_COMMIT_SHA: "main", GITHUB_SHA: SHA }),
    ).toBe(SHA);
  });

  it("returns undefined when nothing valid is found", () => {
    expect(resolveCommit(undefined, {})).toBeUndefined();
    expect(
      resolveCommit(undefined, { GITHUB_SHA: "refs/heads/main" }),
    ).toBeUndefined();
  });
});
