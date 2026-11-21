-- CreateTable
CREATE TABLE "IssueEnvironment" (
    "issueId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "environment" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IssueEnvironment_pkey" PRIMARY KEY ("issueId","environment")
);

-- CreateIndex
CREATE INDEX "IssueEnvironment_projectId_environment_idx" ON "IssueEnvironment"("projectId", "environment");

-- AddForeignKey
ALTER TABLE "IssueEnvironment" ADD CONSTRAINT "IssueEnvironment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueEnvironment" ADD CONSTRAINT "IssueEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one row per (issue, environment) that already has events.
-- Nothing in "Issue" or "Event" is modified. It runs in this migration's transaction, so a
-- failure leaves no half-filled table. It is idempotent (ON CONFLICT DO NOTHING).
--
-- DEPLOY: the code that fills this table ships AFTER this migration, so events ingested by
-- the old code in between are missing. After deploying the code, run the INSERT below once more.
INSERT INTO "IssueEnvironment" ("issueId", "projectId", "environment", "firstSeenAt")
SELECT e."issueId", e."projectId", e."environment", min(e."timestamp")
FROM "Event" e
GROUP BY e."issueId", e."projectId", e."environment"
ON CONFLICT DO NOTHING;
