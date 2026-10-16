import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EventInput, IngestInput, IngestResult } from '@errwise/shared';
import type { ApiKeyContext } from '../api-keys/api-key.types';
import {
  FINGERPRINT_VERSION,
  buildTitle,
  computeFingerprint,
} from './fingerprint';
import { IngestionRepository, StoreEventData } from './ingestion.repository';

const MAX_FUTURE_MS = 5 * 60_000;
const MAX_AGE_MS = 30 * 86_400_000;

/** A missing, invalid, future or very old timestamp is replaced by the received time. */
function resolveTimestamp(value: string | undefined, now: Date): Date {
  if (!value) return now;
  const date = new Date(value);
  const time = date.getTime();
  if (
    Number.isNaN(time) ||
    time > now.getTime() + MAX_FUTURE_MS ||
    time < now.getTime() - MAX_AGE_MS
  ) {
    return now;
  }
  return date;
}

@Injectable()
export class IngestionService {
  constructor(private readonly repo: IngestionRepository) {}

  async ingest(
    apiKey: ApiKeyContext,
    input: IngestInput,
  ): Promise<IngestResult> {
    const events = Array.isArray(input) ? input : [input];
    const now = new Date();

    let accepted = 0;
    let duplicates = 0;
    for (const event of events) {
      const stored = await this.repo.store(
        this.toRecord(apiKey.projectId, event, now),
      );
      if (stored) accepted += 1;
      else duplicates += 1;
    }
    return { accepted, duplicates };
  }

  private toRecord(
    projectId: string,
    event: EventInput,
    now: Date,
  ): StoreEventData {
    const type = event.type ?? 'Error';
    return {
      projectId, // always from the API key, never from the body
      fingerprint: computeFingerprint({
        type,
        message: event.message,
        stack: event.stack,
      }),
      fingerprintVersion: FINGERPRINT_VERSION,
      title: buildTitle(type, event.message),
      eventId: event.eventId,
      level: event.level,
      type,
      message: event.message,
      stack: event.stack,
      platform: event.platform,
      environment: event.environment,
      release: event.release,
      sdk: event.sdk,
      context: event.context as Prisma.InputJsonObject | undefined,
      timestamp: resolveTimestamp(event.timestamp, now),
    };
  }
}
