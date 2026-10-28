import { Errwise } from "../dist/index.mjs";

Errwise.init({
  apiKey: process.env.ERRWISE_API_KEY,
  endpoint: process.env.ERRWISE_ENDPOINT ?? "http://localhost:4000",
  environment: "development",
  debug: true,
});

setTimeout(() => {
  throw new TypeError("manual crash");
}, 100);
