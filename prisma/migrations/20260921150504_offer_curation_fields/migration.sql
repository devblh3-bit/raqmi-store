-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "productPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stockQty" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "contentLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT;

-- CreateIndex
CREATE INDEX "Offer_dedupeKey_idx" ON "Offer"("dedupeKey");

-- CreateIndex
CREATE INDEX "Offer_productPinned_idx" ON "Offer"("productPinned");
