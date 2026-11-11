-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "lastNotifiedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ProjectSubscription" (
    "userId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "emailNewIssues" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSubscription_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateIndex
CREATE INDEX "ProjectSubscription_projectId_idx" ON "ProjectSubscription"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectSubscription" ADD CONSTRAINT "ProjectSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSubscription" ADD CONSTRAINT "ProjectSubscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
