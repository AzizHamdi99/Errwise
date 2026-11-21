import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface Answer {
  status: number;
  body: Record<string, unknown>;
}

/** Runs the filter on an exception and returns what the client would receive. */
function answer(exception: unknown): Answer {
  const sent: Answer = { status: 0, body: {} };
  const response = {
    status: (status: number) => {
      sent.status = status;
      return {
        json: (body: Record<string, unknown>) => {
          sent.body = body;
        },
      };
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', url: '/v1/auth/login' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return sent;
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('answers with the usual shape', () => {
    const { status, body } = answer(new NotFoundException('Nope'));

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body).toMatchObject({
      statusCode: 404,
      message: 'Nope',
      path: '/v1/auth/login',
    });
    expect(typeof body.timestamp).toBe('string');
    expect(body).not.toHaveProperty('code');
  });

  it('passes on the string code an exception was thrown with', () => {
    const { status, body } = answer(
      new ForbiddenException({
        message: 'Verify your email before signing in',
        code: 'EMAIL_NOT_VERIFIED',
      }),
    );

    expect(status).toBe(403);
    expect(body).toMatchObject({
      message: 'Verify your email before signing in',
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('passes on nothing else from the exception body', () => {
    const { body } = answer(
      new BadRequestException({
        message: 'Validation failed',
        code: 'X',
        secret: 'must-not-leak',
        errors: [{ path: 'a', message: 'b' }],
      }),
    );

    expect(body.code).toBe('X');
    expect(JSON.stringify(body)).not.toContain('must-not-leak');
  });

  it.each([
    ['a number', 42],
    ['an object', { nested: true }],
    ['null', null],
  ])('ignores a code that is %s', (_label, code) => {
    const { body } = answer(new ForbiddenException({ message: 'No', code }));

    expect(body).not.toHaveProperty('code');
  });

  it('hides the details of an unknown error, with no code', () => {
    const error = Object.assign(new Error('database password is hunter2'), {
      code: 'ECONNREFUSED',
    });

    const { status, body } = answer(error);

    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body).not.toHaveProperty('code');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});
