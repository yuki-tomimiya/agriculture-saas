CREATE TABLE "FieldConcern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropId" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "locations" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL,
    "extent" TEXT,
    "notes" TEXT,
    "photoName" TEXT,
    "selectedPestKey" TEXT,
    "followUpResult" TEXT,
    "followedUpAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldConcern_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FieldConcern_cropId_observedAt_idx" ON "FieldConcern"("cropId", "observedAt");
