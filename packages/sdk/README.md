# @errwise/node

[![npm version](https://img.shields.io/npm/v/@errwise/node)](https://www.npmjs.com/package/@errwise/node)
[![license](https://img.shields.io/npm/l/@errwise/node)](https://github.com/AzizHamdi99/errwise/blob/main/packages/sdk/LICENSE)

The official Node.js SDK for **Errwise**. It captures errors in your app and sends them to your Errwise dashboard.

- Zero runtime dependencies
- Never throws into your app and never blocks it
- Batching and automatic retries
- Express and NestJS support
- TypeScript types included (ESM and CommonJS)

> The SDK is in `0.x`. The API may change between minor versions.

## Install

```bash
npm install @errwise/node
```

Requires Node.js 20 or newer.

## Quick start

1. In the dashboard, open your project and create an API key (`ew_live_...`).
2. Put it in your `.env`:

```
ERRWISE_API_KEY=ew_live_...
```

3. Initialize once, as early as possible:

```ts
import { Errwise } from "@errwise/node";

Errwise.init({ apiKey: process.env.ERRWISE_API_KEY });
```

4. Capture an error:

```ts
try {
  riskyOperation();
} catch (error) {
  Errwise.captureException(error);
}
```

The error appears in your dashboard within seconds.

> The SDK reads `process.env` but does not load `.env` files. Next.js and NestJS do it for you. With plain Node, add `import "dotenv/config"` as the first import, or run `node --env-file=.env app.js`.

## Express

Register the handler after your routes and before your own error handler:

```ts
import express from "express";
import { Errwise } from "@errwise/node";

Errwise.init({ apiKey: process.env.ERRWISE_API_KEY });

const app = express();

app.get("/boom", () => {
  throw new Error("test error");
});

app.use(Errwise.expressErrorHandler());

app.listen(3000);
```

Errors with a `4xx` status are not reported. Change that with `shouldCapture`:

```ts
app.use(Errwise.expressErrorHandler({ shouldCapture: () => true }));
```

Express 5 forwards errors from async routes. Express 4 does not, so wrap async routes or upgrade.

## NestJS

Initialize in `main.ts`:

```ts
import { NestFactory } from "@nestjs/core";
import { Errwise } from "@errwise/node";
import { AppModule } from "./app.module";

async function bootstrap() {
  Errwise.init({ apiKey: process.env.ERRWISE_API_KEY });

  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

Register the filter in `app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ErrwiseExceptionFilter } from "@errwise/node/nestjs";

@Module({
  providers: [{ provide: APP_FILTER, useClass: ErrwiseExceptionFilter }],
})
export class AppModule {}
```

`HttpException`s below `500` are not reported. Everything else is. If your key comes from `ConfigModule`, call `init()` after `NestFactory.create`.

## Capturing errors by hand

```ts
Errwise.captureException(error, {
  level: "warning",
  extra: { orderId: 1234 },
});
```

| Option  | Description                                             |
| ------- | ------------------------------------------------------- |
| `level` | `"fatal"`, `"error"` (default), `"warning"` or `"info"` |
| `extra` | Extra JSON-serializable data shown with the error       |

## Options

| Option                  | Default                   | Description                                                  |
| ----------------------- | ------------------------- | ------------------------------------------------------------ |
| `apiKey`                | `ERRWISE_API_KEY` env var | Your project key (`ew_live_...`)                             |
| `environment`           | `NODE_ENV`                | Shown as a filter in the dashboard                           |
| `release`               | `ERRWISE_RELEASE` env var | Your app version                                             |
| `enabled`               | `true`                    | Set to `false` to turn the SDK off (tests, local)            |
| `beforeSend`            | none                      | Edit or drop an event before it is sent. Must be synchronous |
| `captureUncaughtErrors` | `true`                    | Capture uncaught exceptions and unhandled rejections         |
| `endpoint`              | Errwise cloud             | Only set it if you self-host                                 |
| `debug`                 | `false`                   | Print what the SDK is doing                                  |

A wrong configuration never throws. `init` prints a warning and the SDK stays off.

## API

- `Errwise.init(options)`: start the SDK. Call it once.
- `Errwise.captureException(error, options?)`: queue an error and return immediately.
- `Errwise.flush(timeoutMs = 5000)`: send what is queued. Resolves `true` when nothing is left.
- `Errwise.close(timeoutMs = 10000)`: flush, then stop the SDK.
- `Errwise.expressErrorHandler(options?)`: Express middleware.
- `ErrwiseExceptionFilter` (from `@errwise/node/nestjs`): Nest exception filter.

## Privacy

The SDK never sends request bodies, headers, cookies or query strings. It sends the HTTP method and the path. Use `beforeSend` to clean paths or messages, or return `null` to drop an event:

```ts
Errwise.init({
  apiKey: process.env.ERRWISE_API_KEY,
  beforeSend(event) {
    return {
      ...event,
      message: event.message.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>"),
    };
  },
});
```

If `beforeSend` throws or returns something invalid, the event is dropped.

## Scripts and serverless

The process can stop right after your code finishes. Flush before you exit:

```ts
process.on("SIGTERM", async () => {
  await Errwise.close();
  process.exit(0);
});
```

In serverless functions, call `await Errwise.flush()` in a `finally` block.

## Troubleshooting

Set `debug: true` and look for lines starting with `[errwise]`.

| You see                                           | Cause                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Not initialized: apiKey is missing or malformed` | The key is missing or wrong. Check that your `.env` is loaded before `init()` |
| `The API key was rejected`                        | The key was revoked or its project was deleted                                |
| `could not reach the API`                         | The API is down. Events are kept and retried                                  |
| Nothing arrives and nothing is printed            | `enabled` is `false`, the error was a `4xx`, or `beforeSend` dropped it       |

## Compatibility

Node.js 20+, ESM and CommonJS, Express 4 and 5, NestJS 9+.

## Issues

https://github.com/AzizHamdi99/errwise/issues

## License

[MIT](https://github.com/AzizHamdi99/errwise/blob/main/packages/sdk/LICENSE)
