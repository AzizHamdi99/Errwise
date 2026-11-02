const { Errwise } = require("../../dist/index.js");
const { ErrwiseExceptionFilter } = require("../../dist/nestjs.js");

Errwise.init({
  apiKey: process.env.ERRWISE_KEY,
  endpoint: process.env.ERRWISE_ENDPOINT,
  environment: "bundles",
  captureUncaughtErrors: false,
});

// a minimal HTTP adapter, enough for BaseExceptionFilter to answer
const adapter = { reply() {}, end() {}, isHeadersSent: () => false };
const host = {
  getType: () => "http",
  getArgByIndex: () => ({}),
  switchToHttp: () => ({
    getRequest: () => ({ method: "GET", originalUrl: "/shared?secret=1" }),
  }),
};

new ErrwiseExceptionFilter(adapter).catch(
  new Error("through the nest bundle"),
  host,
);

Errwise.close().then(() => process.exit(0));
