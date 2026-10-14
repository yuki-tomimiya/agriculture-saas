-- AlterTable
ALTER TABLE "Harvest" ADD COLUMN "countQuantity" REAL;
ALTER TABLE "Harvest" ADD COLUMN "countUnit" TEXT;

-- CreateTable
CREATE TABLE "CropOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropId" TEXT NOT NULL,
    "endReason" TEXT NOT NULL,
    "noHarvest" BOOLEAN NOT NULL DEFAULT false,
    "gradeAShare" INTEGER,
    "gradeAReason" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CropOutcome_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CropOutcome_cropId_key" ON "CropOutcome"("cropId");
