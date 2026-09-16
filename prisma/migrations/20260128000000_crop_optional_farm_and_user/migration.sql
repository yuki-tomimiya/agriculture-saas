-- SQLite: Crop に userId を追加し、farmId を任意にする（作物だけで登録できるようにする）
-- 既存テーブルを変更するため、新テーブル作成 → データ移行 → 差し替え
PRAGMA foreign_keys=OFF;

CREATE TABLE "Crop_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "variety" TEXT,
    "plantingDate" DATETIME,
    "harvestDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'growing',
    "baseTemperature" REAL DEFAULT 10.0,
    "userId" TEXT,
    "farmId" TEXT,
    "fieldId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Crop_new_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Crop_new_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Crop_new_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "Crop_new" ("id", "name", "variety", "plantingDate", "harvestDate", "status", "baseTemperature", "userId", "farmId", "fieldId", "createdAt", "updatedAt")
SELECT "id", "name", "variety", "plantingDate", "harvestDate", "status", "baseTemperature", NULL, "farmId", "fieldId", "createdAt", "updatedAt"
FROM "Crop";

DROP TABLE "Crop";

ALTER TABLE "Crop_new" RENAME TO "Crop";

PRAGMA foreign_keys=ON;
