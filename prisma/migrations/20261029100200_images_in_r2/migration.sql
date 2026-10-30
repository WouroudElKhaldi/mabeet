-- Uploaded photos can live in Cloudflare R2: the bytes column becomes optional, each file gets its storage key,
-- and every photo points at the upload behind it.

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "storedImageId" TEXT;

-- AlterTable
ALTER TABLE "StoredImage" ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "bytes" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_storedImageId_fkey" FOREIGN KEY ("storedImageId") REFERENCES "StoredImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Photos uploaded so far point at /api/images/{id}: link them to that upload.
UPDATE "Photo" SET "storedImageId" = substring(url from '^/api/images/([a-z0-9]+)$')
WHERE url ~ '^/api/images/[a-z0-9]+$';
