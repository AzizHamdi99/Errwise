import type { ProjectPlatform } from "@errwise/shared";

export function getSnippet(platform: ProjectPlatform, apiKey: string): string {
  const init = `Errwise.init({
  apiKey: "${apiKey}",
  environment: "production",
  release: "1.0.0",
});`;

  switch (platform) {
    case "express":
      return `yarn add @errwise/node

import express from "express";
import { Errwise } from "@errwise/node";

${init}

const app = express();
// ...your routes
app.use(Errwise.expressErrorHandler());`;

    case "nestjs":
      return `yarn add @errwise/node

import { NestFactory } from "@nestjs/core";
import { Errwise, ErrwiseExceptionFilter } from "@errwise/node";
import { AppModule } from "./app.module";

${init}

const app = await NestFactory.create(AppModule);
app.useGlobalFilters(new ErrwiseExceptionFilter());`;

    default:
      return `yarn add @errwise/node

import { Errwise } from "@errwise/node";

${init}`;
  }
}
