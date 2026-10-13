-- CreateTable
CREATE TABLE "JmaDailyTemp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockNo" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "tMean" REAL,
    "tMax" REAL,
    "tMin" REAL
);

-- CreateTable
CREATE TABLE "JmaMonthFetch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockNo" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "JmaDailyTemp_blockNo_date_key" ON "JmaDailyTemp"("blockNo", "date");
CREATE INDEX "JmaDailyTemp_blockNo_date_idx" ON "JmaDailyTemp"("blockNo", "date");
CREATE UNIQUE INDEX "JmaMonthFetch_blockNo_year_month_key" ON "JmaMonthFetch"("blockNo", "year", "month");
