import type { CaptureOptions } from "../types";
import { isClientError, requestInfo } from "./http";

export interface ExpressHandlerOptions {
  /** Decide if an error is reported. By default errors with a 4xx status are skipped. */
  shouldCapture?: (error: unknown) => boolean;
}

type Capture = (error: unknown, options?: CaptureOptions) => string | undefined;
type NextFunction = (error?: unknown) => void;

/**
 * Express recognizes an error handler by its 4 parameters, so the signature
 * stays this way. It is structural: there is no dependency on @types/express.
 */
export type ExpressErrorHandler = (
  error: unknown,
  request: unknown,
  response: unknown,
  next: NextFunction,
) => void;

export function createExpressErrorHandler(
  capture: Capture,
  options: ExpressHandlerOptions = {},
): ExpressErrorHandler {
  const shouldCapture =
    options.shouldCapture ?? ((error) => !isClientError(error));

  return function errwiseExpressErrorHandler(error, request, _response, next) {
    try {
      if (shouldCapture(error)) {
        capture(error, {
          request: requestInfo(request),
          extra: { mechanism: "express" },
        });
      }
    } catch {
      /* never break the app's own error handling */
    }
    next(error);
  };
}
