-- CreateTable
CREATE TABLE "PesticideRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL,
    "productName" TEXT NOT NULL,
    "amount" REAL,
    "amountUnit" TEXT,
    "dilution" TEXT,
    "applicationCount" INTEGER,
    "daysBeforeHarvest" INTEGER,
    "cropId" TEXT,
    "farmId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PesticideRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PesticideRecord_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PesticideRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FertilizerRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL,
    "productName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "amountUnit" TEXT NOT NULL DEFAULT 'kg',
    "componentInfo" TEXT,
    "cropId" TEXT,
    "farmId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FertilizerRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FertilizerRecord_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FertilizerRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
