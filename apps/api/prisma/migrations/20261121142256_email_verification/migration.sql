-- CreateTable
CREATE TABLE "EmailVerification" (
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "sentAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- From now on an account cannot sign in until its email is verified. Accounts that exist at the
-- time of this migration were created before that rule: they are marked verified so nobody is
-- locked out. This ASSERTS a verification that never happened, and it is deliberate (decided by
-- the project owner; the app had no real users). It touches only rows that are not verified yet,
-- and it is idempotent. Accounts created after this migration are not affected.
UPDATE "User" SET "emailVerifiedAt" = now() WHERE "emailVerifiedAt" IS NULL;
