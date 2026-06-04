-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PROPER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "password" TEXT;

-- CreateEnum
CREATE TYPE "TalentType" AS ENUM ('PROPER', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "Office" AS ENUM ('TOKYO', 'NAGOYA');

-- AlterTable
ALTER TABLE "Talent" ADD COLUMN "talentType" "TalentType" NOT NULL DEFAULT 'EXTERNAL',
ADD COLUMN "office" "Office",
ADD COLUMN "userId" TEXT UNIQUE;

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_caseId_key" ON "Favorite"("userId", "caseId");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
