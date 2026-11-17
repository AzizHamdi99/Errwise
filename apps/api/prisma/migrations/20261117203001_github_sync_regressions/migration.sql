/*
  Warnings:

  - A unique constraint covering the columns `[projectId,githubIssueNumber]` on the table `Issue` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "githubState" TEXT,
ADD COLUMN     "lastRegressionAt" TIMESTAMPTZ(3),
ADD COLUMN     "regressionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GithubWebhookDelivery" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GithubWebhookDelivery_receivedAt_idx" ON "GithubWebhookDelivery"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_projectId_githubIssueNumber_key" ON "Issue"("projectId", "githubIssueNumber");

-- CreateIndex
CREATE INDEX "Project_githubRepo_idx" ON "Project"("githubRepo");
