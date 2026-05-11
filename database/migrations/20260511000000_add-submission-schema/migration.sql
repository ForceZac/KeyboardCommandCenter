-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('NEW_SHORTCUT', 'CORRECTION', 'APP_REQUEST');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: add isAdmin to users
ALTER TABLE "users" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: submissions
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submitterId" TEXT NOT NULL,
    "appId" TEXT,
    "shortcutId" TEXT,
    "data" JSONB NOT NULL,
    "reviewerNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: submissions.submitterId → users.id
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: submissions.appId → applications.id
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_appId_fkey" FOREIGN KEY ("appId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
