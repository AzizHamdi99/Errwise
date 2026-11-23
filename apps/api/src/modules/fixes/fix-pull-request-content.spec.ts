import type { FixSuggestion } from '@errwise/shared';
import {
  buildPullRequestContent,
  linkedGithubIssue,
} from './fix-pull-request-content';
import type { PullRequestInput } from './fix-pull-request-content';

const ISSUE_URL =
  'https://app.errwise.test/organizations/o1/projects/p1/issues/i1';

function suggestion(overrides: Partial<FixSuggestion> = {}): FixSuggestion {
  return {
    fixable: true,
    prTitle: 'Handle a missing user',
    explanation: 'db.find returns null for an unknown id.',
    confidence: 'high',
    reason: '',
    files: ['src/users.js:3'],
    warnings: [],
    model: 'openai/gpt-oss-120b',
    edits: [],
    ...overrides,
  };
}

function build(overrides: Partial<PullRequestInput> = {}) {
  return buildPullRequestContent({
    suggestion: suggestion(),
    issueUrl: ISSUE_URL,
    githubIssueNumber: null,
    files: ['src/users.js'],
    ...overrides,
  });
}

/** What GitHub would render as text with meaning: the body without fenced and inline code. */
function outsideCode(body: string): string {
  return body.replace(/(`{3,})[\s\S]*?\1/g, '').replace(/`[^`\n]*`/g, '');
}

describe('title', () => {
  it('is the model title with a prefix, on one line', () => {
    expect(build().title).toBe('[Errwise] Handle a missing user');
  });

  it('removes what GitHub turns into a link or a mention, and control characters', () => {
    const { title } = build({
      suggestion: suggestion({
        prTitle: 'Fix #12 for @alice\n`rm -rf`\u0000 <script>',
      }),
    });

    expect(title).not.toMatch(/[#@`<>\n]/);
    expect(title).not.toContain(String.fromCharCode(0));
    expect(title.startsWith('[Errwise] ')).toBe(true);
    expect(title).toContain('Fix 12 for alice');
  });

  it('is capped, and has a fallback when nothing is left of the model title', () => {
    expect(
      build({ suggestion: suggestion({ prTitle: 'x'.repeat(500) }) }).title,
    ).toHaveLength(120);
    expect(build({ suggestion: suggestion({ prTitle: '#@``' }) }).title).toBe(
      '[Errwise] Suggested fix',
    );
  });
});

describe('body', () => {
  it('has one real link, the one the backend built', () => {
    const { body } = build({
      suggestion: suggestion({
        explanation:
          'See [this](https://evil.example) and https://evil.example',
      }),
    });

    // Links GitHub would render: the ones outside code. Inside the fence it is plain text.
    const links = outsideCode(body).match(/\]\(https?:\/\/[^)]*\)/g) ?? [];
    expect(links).toEqual([`](${ISSUE_URL})`]);
    expect(outsideCode(body)).not.toContain('evil.example');
  });

  it('puts the explanation in a plain-text block that nothing can break out of', () => {
    const hostile =
      'Done @alice, see #1\n```\n</details>\n```` and ````` too\n[x](https://evil.example)';
    const { body } = build({
      suggestion: suggestion({ explanation: hostile }),
    });

    const text = outsideCode(body);
    expect(text).not.toContain('@alice');
    expect(text).not.toContain('#1');
    expect(text).not.toContain('</details>');
    // The fence is longer than any run of backticks inside the explanation.
    expect(body).toContain('``````text');
  });

  it('wraps long lines of the explanation', () => {
    const { body } = build({
      suggestion: suggestion({ explanation: 'word '.repeat(100) }),
    });
    // Only the model's own text is wrapped: the fixed intro line is an ordinary paragraph.
    const fenced = /```text\n([\s\S]*?)\n```/.exec(body)?.[1] ?? '';
    const lines = fenced.split('\n');
    expect(lines.length).toBeGreaterThan(4);
    expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(100);
  });

  it('shows the facts as inline code, so a value cannot become markup', () => {
    const { body } = build({
      suggestion: suggestion({ model: 'x|y`z @bob' }),
      files: ['src/a`b|c.js'],
    });

    expect(outsideCode(body)).not.toContain('@bob');
    expect(body).not.toContain('`b|c.js`'); // the pipe and backtick of the path are gone
    expect(body).toContain('| Confidence | `high` |');
  });

  it('lists the warnings with its own wording', () => {
    const { body } = build({
      suggestion: suggestion({
        warnings: ['reads_environment', 'makes_network_call'],
      }),
    });

    expect(body).toContain('### Worth a second look');
    expect(body).toContain('- The change reads environment variables.');
    expect(body).toContain('- The change makes a network call.');
  });

  it('has no warning section when there is nothing to warn about', () => {
    expect(build().body).not.toContain('Worth a second look');
  });

  it('says it is AI-generated, not run, and a draft', () => {
    const { body } = build();
    expect(body).toContain('suggested by an AI');
    expect(body).toContain('has not been run');
    expect(body).toContain('as a draft');
  });

  it('closes the GitHub issue on merge only when it is told which one', () => {
    expect(build({ githubIssueNumber: 12 }).body).toContain('\n\nFixes #12\n');
    expect(build({ githubIssueNumber: null }).body).not.toMatch(
      /\b(fixes|closes|resolves)\b/i,
    );
  });

  it('is never longer than GitHub accepts', () => {
    const { body } = build({
      suggestion: suggestion({ explanation: 'x'.repeat(1_500) }),
      files: Array.from({ length: 5_000 }, (_, i) => `src/file-${i}.js`),
    });
    expect(body.length).toBeLessThanOrEqual(60_000);
  });

  it('names at most ten files, and says how many more', () => {
    const { body } = build({
      files: Array.from({ length: 13 }, (_, i) => `src/f${i}.js`),
    });
    expect(body).toContain('`src/f9.js`');
    expect(body).not.toContain('`src/f10.js`');
    expect(body).toContain('and 3 more');
  });
});

describe('commit message', () => {
  it('has no text of the model, only ours and the link', () => {
    const { commitMessage } = build({
      suggestion: suggestion({
        prTitle: 'Fixes #99 closes #98 @alice',
        explanation: 'Fixes #97 resolves #96 @bob',
      }),
    });

    expect(commitMessage).not.toMatch(/@|#\d|Fixes|resolves/);
    expect(commitMessage).toContain(`Errwise issue: ${ISSUE_URL}`);
    expect(commitMessage.split('\n')[0]).toBe(
      'Apply an AI-suggested fix from Errwise',
    );
  });
});

describe('linkedGithubIssue', () => {
  const issue = {
    githubIssueNumber: 12,
    githubIssueUrl: 'https://github.com/acme/shop/issues/12',
  };

  it('returns the number of an issue of the same repository', () => {
    expect(linkedGithubIssue(issue, 'acme/shop')).toBe(12);
  });

  it('compares the repository without case, like GitHub', () => {
    expect(linkedGithubIssue(issue, 'Acme/Shop')).toBe(12);
  });

  it('is null for an issue of another repository: "#12" there could be anything', () => {
    expect(linkedGithubIssue(issue, 'acme/other')).toBeNull();
    expect(linkedGithubIssue(issue, 'other/shop')).toBeNull();
  });

  it('is null when the issue was never created on GitHub, or the link is odd', () => {
    expect(
      linkedGithubIssue(
        { githubIssueNumber: null, githubIssueUrl: null },
        'acme/shop',
      ),
    ).toBeNull();
    expect(
      linkedGithubIssue({ ...issue, githubIssueUrl: null }, 'acme/shop'),
    ).toBeNull();
    expect(
      linkedGithubIssue(
        {
          ...issue,
          githubIssueUrl: 'https://evil.example/acme/shop/issues/12',
        },
        'acme/shop',
      ),
    ).toBeNull();
    expect(
      linkedGithubIssue(
        { ...issue, githubIssueUrl: 'https://github.com/acme/shop/issues/13' },
        'acme/shop',
      ),
    ).toBeNull();
  });
});
