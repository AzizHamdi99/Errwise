import { Errwise } from "../../dist/index.mjs";

Errwise.init({
  apiKey: process.env.ERRWISE_KEY,
  endpoint: process.env.ERRWISE_ENDPOINT,
  environment: "child",
});

switch (process.env.MODE) {
  case "uncaught":
    setTimeout(() => {
      throw new TypeError("crashed on purpose");
    }, 20);
    break;

  case "rejection":
    setTimeout(() => {
      Promise.reject(new RangeError("rejected on purpose"));
    }, 20);
    break;

  case "handled":
    // the app has its own handler: the SDK must not take over
    process.on("uncaughtException", () => console.log("handled by the app"));
    setTimeout(() => {
      throw new Error("error handled by the app");
    }, 20);
    setTimeout(() => void Errwise.close(), 200);
    break;

  case "before-exit":
    // no flush, no close: the script just ends
    Errwise.captureException(new Error("left in the queue"));
    break;
}
