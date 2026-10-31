CREATE TABLE "OpenMeteoDaily" (
  "location" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "tempMean" REAL,
  "tempMax" REAL,
  "tempMin" REAL,
  "precip" REAL,
  "radiation" REAL,
  "sunshine" REAL,
  "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("location", "date")
);

CREATE TABLE "OpenMeteoElevation" (
  "location" TEXT NOT NULL PRIMARY KEY,
  "metres" REAL NOT NULL
);
