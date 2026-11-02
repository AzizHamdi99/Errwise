import {
  Controller,
  Get,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Errwise } from "../src";
import type { ErrwiseEvent } from "../src";
import { ErrwiseExceptionFilter } from "../src/nestjs";
import { startFakeServer } from "./fake-server";
import type { FakeServer } from "./fake-server";

const API_KEY = `ew_live_${"a".repeat(32)}`;

@Controller()
class DemoController {
  @Get("boom")
  boom(): never {
    throw new TypeError("nest boom");
  }

  @Get("missing")
  missing(): never {
    throw new NotFoundException("no such user");
  }

  @Get("down")
  down(): never {
    throw new ServiceUnavailableException("database is down");
  }
}

let server: FakeServer;
let app: INestApplication;

beforeEach(async () => {
  server = await startFakeServer();
  Errwise.init({
    apiKey: API_KEY,
    endpoint: server.url,
    environment: "test",
    captureUncaughtErrors: false,
  });

  const moduleRef = await Test.createTestingModule({
    controllers: [DemoController],
    providers: [{ provide: APP_FILTER, useClass: ErrwiseExceptionFilter }],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterEach(async () => {
  await app.close();
  await Errwise.close(100);
  await server.close();
});

const sentEvents = () =>
  server.received.flatMap((r) => r.body as ErrwiseEvent[]);

describe("ErrwiseExceptionFilter", () => {
  it("reports an unexpected error and keeps Nest default response", async () => {
    const res = await request(app.getHttpServer()).get("/boom?x=1").expect(500);
    expect(res.body).toMatchObject({ statusCode: 500 });

    await Errwise.flush();
    expect(sentEvents()).toHaveLength(1);
    expect(sentEvents()[0]).toMatchObject({
      type: "TypeError",
      message: "nest boom",
      context: {
        request: { method: "GET", path: "/boom" },
        extra: { mechanism: "nestjs" },
      },
    });
  });

  it("does not report a 4xx HttpException, and keeps its response", async () => {
    const res = await request(app.getHttpServer()).get("/missing").expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      message: "no such user",
    });

    await Errwise.flush();
    expect(server.received).toHaveLength(0);
  });

  it("reports a 5xx HttpException", async () => {
    await request(app.getHttpServer()).get("/down").expect(503);

    await Errwise.flush();
    expect(sentEvents()[0]).toMatchObject({
      type: "ServiceUnavailableException",
      message: "database is down",
    });
  });
});
