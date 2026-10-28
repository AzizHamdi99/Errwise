import { Errwise } from "../dist/index.mjs";

Errwise.init({
  apiKey: process.env.ERRWISE_API_KEY,
  endpoint: process.env.ERRWISE_ENDPOINT ?? "http://localhost:4000",
  environment: "resilience",
  debug: true,
});

let tick = 0;
const timer = setInterval(() => {
  tick += 1;
  Errwise.captureException(new Error(`tick ${tick}`));
  console.log("captured tick", tick);
}, 1000);

setTimeout(async () => {
  clearInterval(timer);
  console.log("flush ->", await Errwise.flush(5000));
  await Errwise.close();
}, 40_000);
