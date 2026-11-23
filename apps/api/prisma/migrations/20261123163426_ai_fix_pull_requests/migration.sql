-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "fixPullRequestsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "IssueFix" (
    "id" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "inputHash" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "edits" JSONB,
    "prClaimedAt" TIMESTAMPTZ(3),
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "prOpenedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueFix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssueFix_issueId_createdAt_idx" ON "IssueFix"("issueId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "IssueFix_issueId_inputHash_key" ON "IssueFix"("issueId", "inputHash");

-- CreateIndex
CREATE UNIQUE INDEX "IssueFix_repo_prNumber_key" ON "IssueFix"("repo", "prNumber");

-- AddForeignKey
ALTER TABLE "IssueFix" ADD CONSTRAINT "IssueFix_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueFix" ADD CONSTRAINT "IssueFix_prOpenedById_fkey" FOREIGN KEY ("prOpenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
