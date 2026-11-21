/**
 * Escapes the characters that mean something inside a LIKE / ILIKE pattern, so a search term
 * matches itself. Prisma's `contains` builds `%term%` and does not escape the term: searching
 * "%" matched every row, and "time_ut" matched "timeout" because "_" is "any single character".
 * PostgreSQL uses the backslash as the escape character unless told otherwise.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}
