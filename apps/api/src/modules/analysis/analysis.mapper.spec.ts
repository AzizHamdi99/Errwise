import type { IssueAnalysis } from '@prisma/client';
import { toPublicAnalysis } from './analysis.mapper';

const OLD_RESULT = {
  summary: 'getUser crashed.',
  probableCause: 'The lookup returned nothing.',
  suggestedFix: 'Check the result.',
  confidence: 'medium',
  framesUsed: [],
  promptVersion: 'v3',
  model: 'm',
};

function row(result: unknown): IssueAnalysis {
  return {
    id: 'a',
    issueId: 'i',
    inputHash: 'h',
    promptVersion: 'v3',
    model: 'm',
    result,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as IssueAnalysis;
}

describe('toPublicAnalysis', () => {
  it('reads a row stored before prompt v4 (no title, no repro steps)', () => {
    const analysis = toPublicAnalysis(row(OLD_RESULT), true);
    expect(analysis.issueTitle).toBeUndefined();
    expect(analysis.reproSteps).toBeUndefined();
    expect(analysis.sourceFiles).toEqual([]);
  });

  it('keeps the v4 fields when they are there', () => {
    const analysis = toPublicAnalysis(
      row({ ...OLD_RESULT, issueTitle: 'Crash', reproSteps: ['Call it.'] }),
      false,
    );
    expect(analysis.issueTitle).toBe('Crash');
    expect(analysis.reproSteps).toEqual(['Call it.']);
  });
});
