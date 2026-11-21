-- Sorting the issue list by first seen and by event count. Backward compatible: old code never
-- names an index. NOTE: indexing "eventCount" (it changes on every event) means the update of the
-- counter can no longer be a HOT update; see docs/perf/issues-list.md (ISSUE-6) for the measurement.

-- CreateIndex
CREATE INDEX "Issue_projectId_status_firstSeenAt_id_idx" ON "Issue"("projectId", "status", "firstSeenAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Issue_projectId_status_eventCount_id_idx" ON "Issue"("projectId", "status", "eventCount" DESC, "id" DESC);
