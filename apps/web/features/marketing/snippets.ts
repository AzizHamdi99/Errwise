/** Checked against packages/sdk. The NestJS filter lives in the "/nestjs" entry. */
export const NODE_SNIPPET = `import { Errwise } from "@errwise/node";

// As early as possible. Uncaught errors are captured from here on.
Errwise.init({ apiKey: process.env.ERRWISE_API_KEY });

try {
  await chargeCustomer(order);
} catch (error) {
  Errwise.captureException(error, { extra: { orderId: order.id } });
}`;

export const EXPRESS_SNIPPET = `import express from "express";
import { Errwise } from "@errwise/node";

Errwise.init({ apiKey: process.env.ERRWISE_API_KEY });

const app = express();

app.get("/boom", () => {
  throw new Error("test error");
});

// After your routes, before your own error handler.
app.use(Errwise.expressErrorHandler());

app.listen(3000);`;

export const NEST_SNIPPET = `// main.ts
import { NestFactory } from "@nestjs/core";
import { Errwise } from "@errwise/node";
import { AppModule } from "./app.module";

async function bootstrap() {
  Errwise.init({ apiKey: process.env.ERRWISE_API_KEY });
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();

// app.module.ts
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ErrwiseExceptionFilter } from "@errwise/node/nestjs";

@Module({
  providers: [{ provide: APP_FILTER, useClass: ErrwiseExceptionFilter }],
})
export class AppModule {}`;
