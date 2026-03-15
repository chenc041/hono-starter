-- Rename username column to email in refresh token table
ALTER TABLE "RefreshToken" RENAME COLUMN "username" TO "email";

-- Add auth identity table for email/password login
CREATE TABLE "UserAuth" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserAuth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAuth_email_key" ON "UserAuth"("email");
CREATE INDEX "UserAuth_status_idx" ON "UserAuth"("status");
