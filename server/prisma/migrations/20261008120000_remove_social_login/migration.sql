-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "universityId" INTEGER NOT NULL,
    "department" TEXT,
    "classYear" INTEGER,
    "age" INTEGER,
    "bio" TEXT,
    "photoUrl" TEXT,
    "interests" TEXT,
    "hobbies" TEXT,
    "instagramUrl" TEXT,
    "twitterUrl" TEXT,
    "linkedinUrl" TEXT,
    "intent" TEXT NOT NULL DEFAULT 'friendship',
    "notifyMatches" BOOLEAN NOT NULL DEFAULT true,
    "notifyMessages" BOOLEAN NOT NULL DEFAULT true,
    "notifyPostActivity" BOOLEAN NOT NULL DEFAULT true,
    "profileVisibility" TEXT NOT NULL DEFAULT 'everyone',
    "showActivityStatus" BOOLEAN NOT NULL DEFAULT true,
    "swipeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "language" TEXT NOT NULL DEFAULT 'tr',
    "lastSeenAt" DATETIME,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "studentDocUrl" TEXT,
    "studentDocStatus" TEXT NOT NULL DEFAULT 'none',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "premiumUntil" DATETIME,
    "premiumSince" DATETIME,
    "ocrExtractedText" TEXT,
    "ocrAutoCheckPassed" BOOLEAN,
    "ocrProcessedAt" DATETIME,
    "birthDate" DATETIME,
    "lastBirthdayNotifiedYear" INTEGER,
    "weeklySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastWeeklySummaryAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("age", "bio", "birthDate", "classYear", "createdAt", "department", "email", "fullName", "hobbies", "id", "instagramUrl", "intent", "interests", "isAdmin", "isBanned", "isFrozen", "isPremium", "language", "lastBirthdayNotifiedYear", "lastSeenAt", "lastWeeklySummaryAt", "linkedinUrl", "notifyMatches", "notifyMessages", "notifyPostActivity", "ocrAutoCheckPassed", "ocrExtractedText", "ocrProcessedAt", "passwordHash", "photoUrl", "premiumSince", "premiumUntil", "profileVisibility", "rejectionReason", "showActivityStatus", "studentDocStatus", "studentDocUrl", "swipeEnabled", "theme", "tokenVersion", "twitterUrl", "universityId", "updatedAt", "verificationStatus", "weeklySummaryEnabled") SELECT "age", "bio", "birthDate", "classYear", "createdAt", "department", "email", "fullName", "hobbies", "id", "instagramUrl", "intent", "interests", "isAdmin", "isBanned", "isFrozen", "isPremium", "language", "lastBirthdayNotifiedYear", "lastSeenAt", "lastWeeklySummaryAt", "linkedinUrl", "notifyMatches", "notifyMessages", "notifyPostActivity", "ocrAutoCheckPassed", "ocrExtractedText", "ocrProcessedAt", "passwordHash", "photoUrl", "premiumSince", "premiumUntil", "profileVisibility", "rejectionReason", "showActivityStatus", "studentDocStatus", "studentDocUrl", "swipeEnabled", "theme", "tokenVersion", "twitterUrl", "universityId", "updatedAt", "verificationStatus", "weeklySummaryEnabled" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_universityId_idx" ON "User"("universityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

