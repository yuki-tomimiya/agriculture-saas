CREATE TABLE "PestCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropId" TEXT NOT NULL,
    "pestKey" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "present" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PestCheck_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PestCheck_cropId_observedAt_idx" ON "PestCheck"("cropId", "observedAt");
