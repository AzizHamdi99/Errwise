import type { Event, Issue } from '@prisma/client';

const MAX_TITLE_LENGTH = 200; // GitHub allows 256
const MAX_MESSAGE_CHARS = 1_000;
const MAX_STACK_CHARS = 4_000;
const MAX_CELL_CHARS = 100;

export interface GithubIssueContent {
  title: string;
  body: string;
}

interface BuildInput {
  issue: Issue;
  event: Event | null;
  issueUrl: string;
}

export function buildGithubIssueContent({
  issue,
  event,
  issueUrl,
}: BuildInput): GithubIssueContent {
  const rows: [string, string][] = [
    ['Status', issue.status],
    ['Level', issue.level],
    ['Environment', event?.environment ?? 'unknown'],
    ['Release', event?.release ?? issue.lastRelease ?? 'unknown'],
    ['Occurrences', String(issue.eventCount)],
    ['First seen', issue.firstSeenAt.toISOString()],
    ['Last seen', issue.lastSeenAt.toISOString()],
  ];

  const sections = [
    `**[View in Errwise](${issueUrl})**`,
    [
      '| | |',
      '|---|---|',
      ...rows.map(([label, value]) => `| ${label} | ${cell(value)} |`),
    ].join('\n'),
  ];

  if (event) {
    sections.push(
      '### Message',
      codeBlock(truncate(event.message, MAX_MESSAGE_CHARS)),
    );
    if (event.stack) {
      sections.push(
        '### Stack trace',
        codeBlock(truncate(event.stack, MAX_STACK_CHARS)),
      );
    }
  }
  sections.push('---', '_Created from Errwise_');

  return {
    title: truncate(`[Errwise] ${issue.title}`, MAX_TITLE_LENGTH),
    body: sections.join('\n\n'),
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Inline code keeps SDK-provided values from becoming markdown or @mentions. */
function cell(value: string): string {
  return `\`${value.replace(/[`|\r\n]+/g, ' ').slice(0, MAX_CELL_CHARS)}\``;
}

/** The fence is longer than any backtick run inside, so the text cannot break out. */
function codeBlock(text: string): string {
  const longestRun = Math.max(
    0,
    ...(text.match(/`+/g) ?? []).map((r) => r.length),
  );
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}\n${text}\n${fence}`;
}
