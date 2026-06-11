-- AlterTable
ALTER TABLE "EmailSource" ADD COLUMN     "imapFolders" TEXT[] DEFAULT ARRAY['INBOX']::TEXT[];
