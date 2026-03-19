-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'UNKNOWN';

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "emailId" TEXT;

-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "messageId" TEXT;

-- CreateTable
CREATE TABLE "EmailSource" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapUser" TEXT NOT NULL,
    "imapPass" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Email_messageId_key" ON "Email"("messageId");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;
