import { describe, expect, it } from "vitest";
import { isClientError, requestInfo } from "../src/integrations/http";

describe("requestInfo", () => {
  it("reads an Express request, preferring originalUrl", () => {
    expect(
      requestInfo({
        method: "GET",
        originalUrl: "/api/users?x=1",
        url: "/users",
      }),
    ).toEqual({ method: "GET", path: "/api/users?x=1" });
  });

  it("reads a Fastify or Node request", () => {
    expect(requestInfo({ method: "POST", url: "/health" })).toEqual({
      method: "POST",
      path: "/health",
    });
  });

  it("returns undefined for anything else", () => {
    expect(requestInfo(undefined)).toBeUndefined();
    expect(requestInfo("GET /")).toBeUndefined();
    expect(requestInfo({ method: "GET" })).toBeUndefined();
    expect(requestInfo({ url: "/x" })).toBeUndefined();
  });
});

describe("isClientError", () => {
  it("is true for 4xx statuses", () => {
    expect(isClientError({ status: 404 })).toBe(true);
    expect(isClientError({ statusCode: 400 })).toBe(true);
  });

  it("is false for everything else", () => {
    expect(isClientError({ status: 500 })).toBe(false);
    expect(isClientError({ status: "404" })).toBe(false);
    expect(isClientError(new Error("x"))).toBe(false);
    expect(isClientError("oops")).toBe(false);
    expect(isClientError(undefined)).toBe(false);
  });
});
