import { Catch, HttpException } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Errwise } from "./errwise";
import { isClientError, requestInfo } from "./integrations/http";

/** 4xx errors are the client's mistake. 5xx and every unknown error are reported. */
function isExpected(exception: unknown): boolean {
  return exception instanceof HttpException
    ? exception.getStatus() < 500
    : isClientError(exception);
}

/**
 * Reports unexpected errors, then lets Nest answer exactly as it would without this
 * filter (it extends BaseExceptionFilter). Meant for HTTP applications.
 */
@Catch()
export class ErrwiseExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const isHttp = host.getType() === "http";

    try {
      if (!isExpected(exception)) {
        Errwise.captureException(exception, {
          request: isHttp
            ? requestInfo(host.switchToHttp().getRequest<unknown>())
            : undefined,
          extra: { mechanism: "nestjs" },
        });
      }
    } catch {
      /* never break Nest's error handling */
    }

    // The default behavior assumes HTTP: for other transports, report and rethrow.
    if (!isHttp) throw exception;
    super.catch(exception, host);
  }
}
