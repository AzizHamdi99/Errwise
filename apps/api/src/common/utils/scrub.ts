/**
 * Removes secrets and personal data from an event.
 *
 * Runs on ingestion (the SDK is untrusted) and again before anything leaves for
 * the AI service, because events stored before scrubbing existed are not clean.
 * Pure and idempotent. Every
 * regex has bounded quantifiers so a 50 KB hostile string cannot make the
 * ingestion path slow (no catastrophic backtracking).
 */

const MAX_DEPTH = 8;

const EMAIL = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}/g;
const BEARER = /\b(Bearer|Basic)\s{1,8}[A-Za-z0-9._~+/=-]{8,512}/gi;
const AUTH_HEADER =
  /\b((?:proxy-)?authorization["']?\s{0,4}[:=]\s{0,4}["']?)[^\r\n"',;]{1,512}/gi;
const JWT =
  /\beyJ[A-Za-z0-9_-]{5,2048}\.[A-Za-z0-9_-]{5,2048}\.[A-Za-z0-9_-]{5,2048}/g;
const API_KEY = new RegExp(
  [
    'ew_live_[A-Za-z0-9]{32}',
    '\\bsk-[A-Za-z0-9_-]{20,200}',
    '\\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,200}',
    '\\bgh[pousr]_[A-Za-z0-9]{36,255}',
    '\\bgithub_pat_[A-Za-z0-9_]{20,255}',
    '\\bAKIA[0-9A-Z]{16}',
    '\\bxox[abprs]-[A-Za-z0-9-]{10,200}',
  ].join('|'),
  'g',
);
const URL_CREDENTIALS =
  /(\b[a-z][a-z0-9+.-]{1,20}:\/\/)[^\s/:@]{1,128}:[^\s/@]{1,128}@/gi;
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;

const SENSITIVE_KEY =
  /pass(?:word|wd)?|secret|token|authorization|cookie|api[-_]?key|session|credential|private[-_]?key/i;

/** The text fields that can carry secrets. Anything else on the object is kept as is. */
export interface ScrubbableEvent {
  type?: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

export interface ScrubResult<T extends ScrubbableEvent = ScrubbableEvent> {
  event: T;
  /** How many values were replaced. Useful for tests and metrics, never the values. */
  redactions: number;
}

/** Luhn checksum, so a random 16-digit order id is not mistaken for a card. */
function isCardNumber(candidate: string): boolean {
  const digits = candidate.replace(/[ -]/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

class Scrubber {
  redactions = 0;

  string(value: string): string {
    let out = value;
    out = this.replace(out, JWT, '[jwt]');
    out = this.replace(out, API_KEY, '[key]');
    out = this.replace(out, URL_CREDENTIALS, '$1[credentials]@');
    out = this.replace(out, AUTH_HEADER, '$1[token]');
    out = this.replace(out, BEARER, '$1 [token]');
    if (out.includes('@')) out = this.replace(out, EMAIL, '[email]');
    out = out.replace(CARD, (match) => {
      if (!isCardNumber(match)) return match;
      this.redactions += 1;
      return '[card]';
    });
    return out;
  }

  value(value: unknown, depth: number): unknown {
    if (typeof value === 'string') return this.string(value);
    if (value === null || typeof value !== 'object') return value;
    if (depth >= MAX_DEPTH) {
      this.redactions += 1;
      return '[truncated]';
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.value(item, depth + 1));
    }
    // fromEntries defines own properties, so a "__proto__" key cannot change the prototype.
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (SENSITIVE_KEY.test(key)) {
          // Already masked by an earlier pass: keep the count honest.
          if (item !== '[redacted]') this.redactions += 1;
          return [key, '[redacted]'];
        }
        return [key, this.value(item, depth + 1)];
      }),
    );
  }

  private replace(input: string, pattern: RegExp, replacement: string): string {
    return input.replace(pattern, (...args: unknown[]) => {
      this.redactions += 1;
      // Expand $1 style references against the capture groups by hand,
      // so the count stays exact.
      return replacement.replace(/\$(\d)/g, (_m, n: string) => {
        const group = args[Number(n)];
        return typeof group === 'string' ? group : '';
      });
    });
  }
}

/** Pure: returns a new event and never changes the input. */
export function scrubEvent<T extends ScrubbableEvent>(
  event: T,
): ScrubResult<T> {
  const scrubber = new Scrubber();
  const scrubbed: T = {
    ...event,
    type: event.type === undefined ? undefined : scrubber.string(event.type),
    message: scrubber.string(event.message),
    stack: event.stack === undefined ? undefined : scrubber.string(event.stack),
    context:
      event.context === undefined
        ? undefined
        : (scrubber.value(event.context, 0) as Record<string, unknown>),
  };
  return { event: scrubbed, redactions: scrubber.redactions };
}

/** Scrubs one piece of free text, such as a snippet of source code. */
export function scrubText(text: string): string {
  return new Scrubber().string(text);
}
