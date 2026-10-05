-- CreateTable
CREATE TABLE "SoilDiagnosis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldId" TEXT,
    "diagnosedAt" DATETIME NOT NULL,
    "ph" REAL,
    "ec" REAL,
    "nitrogen" REAL,
    "phosphorus" REAL,
    "potassium" REAL,
    "notes" TEXT,
    "photoPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SoilDiagnosis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SoilDiagnosis_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SoilDiagnosis_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SoilDiagnosis_userId_diagnosedAt_idx" ON "SoilDiagnosis"("userId", "diagnosedAt");
