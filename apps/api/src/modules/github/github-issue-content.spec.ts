import type { Event, Issue } from '@prisma/client';
import {
  buildGithubIssueContent,
  type GithubIssueAnalysis,
} from './github-issue-content';

const ISSUE_URL = 'https://errwise.test/organizations/o/projects/p/issues/i';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    title: 'TypeError: x is undefined',
    status: 'unresolved',
    level: 'error',
    eventCount: 3,
    lastRelease: '1.2.0',
    firstSeenAt: new Date('2026-01-01T00:00:00.000Z'),
    lastSeenAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as Issue;
}

function event(overrides: Partial<Event> = {}): Event {
  return {
    message: 'x is undefined',
    stack: 'TypeError: x is undefined\n    at getUser (/app/users.js:10:5)',
    environment: 'production',
    release: '1.2.0',
    ...overrides,
  } as Event;
}

function analysis(
  overrides: Partial<GithubIssueAnalysis> = {},
): GithubIssueAnalysis {
  return {
    summary: 'getUser read a property of undefined.',
    probableCause: 'The lookup returned nothing.',
    suggestedFix: 'Check the lookup result first.',
    confidence: 'medium',
    model: 'test-model',
    createdAt: new Date('2026-03-04T10:00:00.000Z'),
    issueTitle: 'getUser crashes when the user is missing',
    reproSteps: ['Call getUser with an unknown id.', 'Read the name.'],
    sourceFiles: ['src/users.js:10'],
    ...overrides,
  };
}

function build(
  parts: {
    issue?: Issue;
    event?: Event | null;
    analysis?: GithubIssueAnalysis | null;
  } = {},
) {
  return buildGithubIssueContent({
    issue: parts.issue ?? issue(),
    event: parts.event === undefined ? event() : parts.event,
    issueUrl: ISSUE_URL,
    analysis: parts.analysis,
  });
}

/** The body with every fenced block removed: what GitHub would render as markdown. */
function outsideFences(body: string): string {
  return body.replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1$/gm, '');
}

describe('buildGithubIssueContent without an analysis', () => {
  it('keeps the plain template and has no AI section', () => {
    const { title, body } = build();
    expect(title).toBe('[Errwise] TypeError: x is undefined');
    expect(body).toContain(`[View in Errwise](${ISSUE_URL})`);
    expect(body).toContain('### Message');
    expect(body).toContain('### Stack trace');
    expect(body).not.toContain('### AI analysis');
  });

  it('works with no event at all', () => {
    const { body, labels } = build({ event: null });
    expect(body).not.toContain('### Message');
    expect(labels).toEqual(['errwise', 'bug', 'level:error']);
  });
});

describe('buildGithubIssueContent with an analysis', () => {
  it('uses the AI title and shows every section', () => {
    const { title, body } = build({ analysis: analysis() });
    expect(title).toBe('[Errwise] getUser crashes when the user is missing');
    expect(body).toContain('### AI analysis');
    expect(body).toContain('`test-model`');
    expect(body).toContain('2026-03-04');
    expect(body).toContain('**Summary**');
    expect(body).toContain('**Probable cause**');
    expect(body).toContain('**Suggested fix**');
    expect(body).toContain('1. Call getUser with an unknown id.');
    expect(body).toContain('2. Read the name.');
    expect(body).toContain('`src/users.js:10`');
  });

  it('handles an analysis stored before prompt v4 (no title, no steps)', () => {
    const { title, body } = build({
      analysis: analysis({
        issueTitle: undefined,
        reproSteps: undefined,
        sourceFiles: undefined,
      }),
    });
    expect(title).toBe('[Errwise] TypeError: x is undefined');
    expect(body).toContain('### AI analysis');
    expect(body).not.toContain('Steps to reproduce');
    expect(body).not.toContain('Code read');
  });

  it('omits the steps section when the model gave none', () => {
    const { body } = build({ analysis: analysis({ reproSteps: [] }) });
    expect(body).not.toContain('Steps to reproduce');
  });

  it('cannot be broken out of its fence by backticks in the model text', () => {
    const hostile = '```\n# pwned\n```\n````\n@octocat';
    const { body } = build({
      analysis: analysis({ summary: hostile, probableCause: hostile }),
    });
    const rendered = outsideFences(body);
    expect(rendered).not.toContain('pwned');
    expect(rendered).not.toContain('@octocat');
  });

  it('keeps mentions, issue references and links inside fences', () => {
    const text =
      'ping @octocat, see #12 and https://evil.example/x, sha abc1234';
    const { body } = build({
      analysis: analysis({
        summary: text,
        probableCause: text,
        suggestedFix: text,
        reproSteps: [text],
        issueTitle: undefined,
      }),
      event: event({ message: text }),
    });
    const rendered = outsideFences(body);
    for (const risky of ['@octocat', '#12', 'evil.example', 'abc1234']) {
      expect(rendered).not.toContain(risky);
    }
  });

  it('wraps long model text and never leaves a line over the limit', () => {
    const long = `${'word '.repeat(80)}${'x'.repeat(300)}`;
    const { body } = build({ analysis: analysis({ probableCause: long }) });
    const block = body
      .split('**Probable cause**')[1]
      .split('**Suggested fix**')[0];
    for (const line of block.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(100);
    }
  });

  it('cleans markdown and control characters out of a model-chosen title', () => {
    const { title } = build({
      analysis: analysis({ issueTitle: 'Crash\r\n\u0000in\tgetUser  now' }),
    });
    expect(title).toBe('[Errwise] Crash in getUser now');
  });

  it('falls back to the issue title when the AI title is blank after cleaning', () => {
    const { title } = build({ analysis: analysis({ issueTitle: ' \n\t ' }) });
    expect(title).toBe('[Errwise] TypeError: x is undefined');
  });

  it('shows at most five source files', () => {
    const files = Array.from({ length: 9 }, (_, i) => `f${i}.js:1`);
    const { body } = build({ analysis: analysis({ sourceFiles: files }) });
    expect(body).toContain('`f4.js:1`');
    expect(body).not.toContain('f5.js');
  });
});

describe('labels', () => {
  it('uses the fixed set plus level and environment', () => {
    expect(build().labels).toEqual([
      'errwise',
      'bug',
      'level:error',
      'env:production',
    ]);
  });

  it('cleans SDK-provided values and caps the length', () => {
    const { labels } = build({
      issue: issue({ level: 'Fatal!!' }),
      event: event({ environment: `Prod Eu/West ${'z'.repeat(80)}` }),
    });
    expect(labels).toContain('level:fatal');
    const env = labels.find((l) => l.startsWith('env:'));
    expect(env).toMatch(/^env:prod-eu-west-z+$/);
    for (const label of labels) {
      expect(label.length).toBeLessThanOrEqual(50);
    }
  });

  it('skips a label whose value is empty after cleaning', () => {
    const { labels } = build({ event: event({ environment: '///' }) });
    expect(labels.some((l) => l.startsWith('env:'))).toBe(false);
  });

  it('has no duplicates', () => {
    const { labels } = build({ issue: issue({ level: 'bug' }) });
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('size', () => {
  it('stays under the GitHub body limit with maximum-size inputs', () => {
    const { body, title } = build({
      issue: issue({ title: 't'.repeat(500) }),
      event: event({ message: 'm'.repeat(5_000), stack: 's'.repeat(50_000) }),
      analysis: analysis({
        summary: 'a'.repeat(500),
        probableCause: 'b '.repeat(1_000),
        suggestedFix: 'c '.repeat(1_000),
        reproSteps: Array.from({ length: 5 }, () => 'd '.repeat(150)),
        issueTitle: 'e'.repeat(120),
      }),
    });
    expect(body.length).toBeLessThan(65_536);
    expect(title.length).toBeLessThanOrEqual(200);
  });
});
