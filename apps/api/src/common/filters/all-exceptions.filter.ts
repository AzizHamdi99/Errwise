import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * The stable `code` an error was thrown with, for the few cases a client has to tell apart
 * (for example EMAIL_NOT_VERIFIED). Only a string `code` is passed on, and only from an
 * HttpException, which our own code builds: nothing from a library error or a user.
 */
function errorCode(exception: HttpException): string | undefined {
  const body = exception.getResponse();
  if (typeof body !== 'object' || body === null || !('code' in body)) return;
  return typeof body.code === 'string' ? body.code : undefined;
}

// Catches EVERY error, logs it, and always answers with the same JSON shape
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const isHttpError = exception instanceof HttpException;
    const status = isHttpError
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Unknown errors are hidden from the client: we only say "Internal server error"
    const message = isHttpError ? exception.message : 'Internal server error';
    const code = isHttpError ? errorCode(exception) : undefined;

    const line = `${request.method} ${request.url} -> ${status} ${message}`;
    if (status >= 500) {
      this.logger.error(
        line,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(line);
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
