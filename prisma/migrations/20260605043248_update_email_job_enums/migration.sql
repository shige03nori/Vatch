/*
  Warnings:

  - The `status` column on the `EmailJob` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `sendType` on the `EmailJob` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'GENERATING', 'SENDING', 'SENT', 'FAILED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "EmailSendType" AS ENUM ('NOW', 'SCHEDULED');

-- DropForeignKey
ALTER TABLE "EmailJob" DROP CONSTRAINT "EmailJob_proposalId_fkey";

-- DropForeignKey
ALTER TABLE "Favorite" DROP CONSTRAINT "Favorite_caseId_fkey";

-- DropForeignKey
ALTER TABLE "Favorite" DROP CONSTRAINT "Favorite_userId_fkey";

-- DropForeignKey
ALTER TABLE "Talent" DROP CONSTRAINT "Talent_userId_fkey";

-- AlterTable
ALTER TABLE "EmailJob" DROP COLUMN "status",
ADD COLUMN     "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "sendType",
ADD COLUMN     "sendType" "EmailSendType" NOT NULL;

-- CreateIndex
CREATE INDEX "EmailJob_status_idx" ON "EmailJob"("status");

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
