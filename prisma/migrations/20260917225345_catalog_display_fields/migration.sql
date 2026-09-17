-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "badge" TEXT,
ADD COLUMN     "compareAtMinor" BIGINT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isNew" BOOLEAN NOT NULL DEFAULT false;
