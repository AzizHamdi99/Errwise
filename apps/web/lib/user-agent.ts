/**
 * A short, human label for a User-Agent header, such as "Chrome on Windows". Good enough to
 * recognize your own devices; not a full parser. Order matters: Edge and Opera also say
 * "Chrome", and Chrome also says "Safari".
 */
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

function match(ua: string, table: [RegExp, string][]): string | null {
  return table.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
}

export function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = match(ua, BROWSERS);
  const system = match(ua, SYSTEMS);
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown device";
}
