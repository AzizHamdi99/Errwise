-- The "All" tab of the issue list has no status filter, so the (projectId, status, lastSeenAt, id)
-- index cannot serve it. Backward compatible: old code never names an index.

-- CreateIndex
CREATE INDEX "Issue_projectId_lastSeenAt_id_idx" ON "Issue"("projectId", "lastSeenAt" DESC, "id" DESC);
