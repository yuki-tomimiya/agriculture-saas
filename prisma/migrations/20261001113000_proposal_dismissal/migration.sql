-- CreateTable
CREATE TABLE "ProposalDismissal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cropId" TEXT,
    "trigger" TEXT NOT NULL,
    "dismissedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remindAfter" DATETIME NOT NULL,
    CONSTRAINT "ProposalDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProposalDismissal_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProposalDismissal_userId_remindAfter_idx" ON "ProposalDismissal"("userId", "remindAfter");
