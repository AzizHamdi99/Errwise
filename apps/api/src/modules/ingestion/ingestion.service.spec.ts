import type { EventInput } from '@errwise/shared';
import type { ApiKeyContext } from '../api-keys/api-key.types';
import type { IssueAlertDispatcher } from '../notifications/issue-alert-dispatcher';
import { FINGERPRINT_VERSION, computeFingerprint } from './fingerprint';
import { IngestionService } from './ingestion.service';
import type {
  IngestionRepository,
  StoreEventData,
} from './ingestion.repository';

const apiKey = { projectId: 'p1', apiKeyId: 'k1' } as ApiKeyContext;

function event(overrides: Partial<EventInput>): EventInput {
  return {
    eventId: '0198a2b4-7c1e-7a3b-8f00-1234567890ab',
    message: 'boom',
    level: 'error',
    environment: 'production',
    platform: 'node',
    ...overrides,
  };
}

describe('IngestionService scrubbing', () => {
  let stored: StoreEventData[];
  let service: IngestionService;

  beforeEach(() => {
    stored = [];
    const repo = {
      store: jest.fn((data: StoreEventData) => {
        stored.push(data);
        return Promise.resolve({
          issueId: 'i1',
          issueCreated: false,
          regressed: false,
        });
      }),
    } as unknown as IngestionRepository;
    const alerts = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    } as unknown as IssueAlertDispatcher;
    service = new IngestionService(repo, alerts);
  });

  it('stores no personal data', async () => {
    await service.ingest(apiKey, [
      event({
        message: 'User bob@x.com not found',
        context: { password: 'hunter2' },
      }),
    ]);

    const [first] = stored;
    expect(first.message).toBe('User [email] not found');
    expect(first.title).toBe('Error: User [email] not found');
    expect(first.context).toEqual({ password: '[redacted]' });
    expect(JSON.stringify(stored)).not.toMatch(/bob@x\.com|hunter2/);
  });

  it('stores the commit from the SDK, or one found in the release', async () => {
    await service.ingest(apiKey, [
      event({ commitSha: 'abcdef1234567' }),
      event({
        eventId: '0198a2b4-7c1e-7a3b-8f00-1234567890ac',
        release: '9fceb02d0ae598e95dc970b74767f19372d61af8',
      }),
      event({
        eventId: '0198a2b4-7c1e-7a3b-8f00-1234567890ad',
        release: '1.4.0',
      }),
    ]);

    expect(stored.map((e) => e.commitSha)).toEqual([
      'abcdef1234567',
      '9fceb02d0ae598e95dc970b74767f19372d61af8',
      undefined,
    ]);
  });

  it('computes the fingerprint from the original message, so scrubbing never regroups issues', async () => {
    const message = 'User bob@x.com not found';
    await service.ingest(apiKey, event({ message }));

    expect(stored[0].fingerprint).toBe(
      computeFingerprint({ type: 'Error', message }),
    );
    expect(stored[0].fingerprint).not.toBe(
      computeFingerprint({ type: 'Error', message: stored[0].message }),
    );
    expect(stored[0].fingerprintVersion).toBe(FINGERPRINT_VERSION);
  });
});
