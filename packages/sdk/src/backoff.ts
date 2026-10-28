/**
 * Delay before retry number `attempt` (1 for the first retry): exponential, capped,
 * with "equal jitter" so many clients don't retry at the same moment.
 */
export function computeBackoff(
  attempt: number,
  baseMs: number,
  maxMs: number,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential / 2 + random() * (exponential / 2));
}
