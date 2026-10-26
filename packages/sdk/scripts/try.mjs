import { Errwise } from "../dist/index.mjs";

const apiKey = process.env.ERRWISE_API_KEY;
if (!apiKey) {
  console.error("Set ERRWISE_API_KEY first.");
  process.exit(1);
}

Errwise.init({
  apiKey,
  endpoint: process.env.ERRWISE_ENDPOINT ?? "http://localhost:4000",
  environment: "development",
  release: "0.1.0",
  debug: true,
});

try {
  JSON.parse("{ not json");
} catch (error) {
  const id = Errwise.captureException(error, { extra: { source: "try.mjs" } });
  console.log("captured", id);
}

Errwise.captureException(
  new TypeError("Cannot read property 'name' of undefined"),
);

await Errwise.close();
