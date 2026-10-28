import type { ErrwiseClient } from "./client";

const FATAL_FLUSH_TIMEOUT_MS = 2_000;
const EXIT_GRACE_MS = 1_000;
const BEFORE_EXIT_FLUSH_TIMEOUT_MS = 2_000;

export interface HookOptions {
  captureUncaughtErrors: boolean;
}

/** With --unhandled-rejections the app chose its own behavior: don't change it. */
function hasRejectionFlag(): boolean {
  return [...process.execArgv, process.env.NODE_OPTIONS ?? ""].some((flag) =>
    flag.includes("--unhandled-rejections"),
  );
}

/** Returns a function that removes everything it installed. */
export function installProcessHooks(
  client: ErrwiseClient,
  options: HookOptions,
): () => void {
  let crashing = false;

  function crash(reason: unknown): void {
    if (crashing) return;
    crashing = true;

    // Adding a listener replaced Node's default crash: print the error and exit ourselves.
    console.error(reason);
    const exit = () => process.exit(1);
    // Not unref'd on purpose: it guarantees exit code 1 even if the flush hangs.
    setTimeout(exit, FATAL_FLUSH_TIMEOUT_MS + EXIT_GRACE_MS);
    void client.flush(FATAL_FLUSH_TIMEOUT_MS).then(exit, exit);
  }

  const onUncaught = (error: Error): void => {
    // If someone else has a listener, they decide what happens: we only report.
    const willCrash = process.listenerCount("uncaughtException") <= 1;
    client.captureException(error, {
      level: willCrash ? "fatal" : "error",
      extra: { mechanism: "uncaughtException" },
    });
    if (willCrash) crash(error);
  };

  const onRejection = (reason: unknown): void => {
    const willCrash =
      process.listenerCount("unhandledRejection") <= 1 && !hasRejectionFlag();
    client.captureException(reason, {
      level: willCrash ? "fatal" : "error",
      extra: { mechanism: "unhandledRejection" },
    });
    if (willCrash) crash(reason);
  };

  // The event loop is empty: the (unref'd) timers had no chance to send what is queued.
  const onBeforeExit = (): void => {
    void client.flush(BEFORE_EXIT_FLUSH_TIMEOUT_MS);
  };

  process.once("beforeExit", onBeforeExit);
  if (options.captureUncaughtErrors) {
    process.on("uncaughtException", onUncaught);
    process.on("unhandledRejection", onRejection);
  }

  return () => {
    process.off("beforeExit", onBeforeExit);
    process.off("uncaughtException", onUncaught);
    process.off("unhandledRejection", onRejection);
  };
}
