-- The issue list pages with the cursor (lastSeenAt, id). With "id" in the index, Postgres can
-- read rows already in ORDER BY order. Backward compatible: old code never names an index.
-- Create the new index first, then drop the old one, so the list is never left without one.

-- CreateIndex
CREATE INDEX "Issue_projectId_status_lastSeenAt_id_idx" ON "Issue"("projectId", "status", "lastSeenAt" DESC, "id" DESC);

-- DropIndex
DROP INDEX "Issue_projectId_status_lastSeenAt_idx";
