-- AlterTable
ALTER TABLE "Event" ADD COLUMN "reminderSentAt" DATETIME;

-- CreateTable
CREATE TABLE "Pass" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromUserId" INTEGER NOT NULL,
    "toUserId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pass_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pass_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adminId" INTEGER,
    "adminName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" INTEGER,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BannedWord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "word" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "content" TEXT,
    "photoUrl" TEXT,
    "audioUrl" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "replyToId" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("audioUrl", "content", "createdAt", "fileName", "fileUrl", "id", "isRead", "matchId", "photoUrl", "senderId") SELECT "audioUrl", "content", "createdAt", "fileName", "fileUrl", "id", "isRead", "matchId", "photoUrl", "senderId" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_matchId_idx" ON "Message"("matchId");
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
    "premiumAutoRenew" BOOLEAN NOT NULL DEFAULT true,
    "schoolEmailVerifiedAt" DATETIME,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_User" ("age", "bio", "birthDate", "classYear", "createdAt", "department", "email", "fullName", "hobbies", "id", "instagramUrl", "intent", "interests", "isAdmin", "isBanned", "isFrozen", "isPremium", "language", "lastBirthdayNotifiedYear", "lastSeenAt", "lastWeeklySummaryAt", "linkedinUrl", "notifyMatches", "notifyMessages", "notifyPostActivity", "ocrAutoCheckPassed", "ocrExtractedText", "ocrProcessedAt", "passwordHash", "photoUrl", "premiumAutoRenew", "premiumSince", "premiumUntil", "profileVisibility", "rejectionReason", "showActivityStatus", "studentDocStatus", "studentDocUrl", "swipeEnabled", "theme", "tokenVersion", "twitterUrl", "universityId", "updatedAt", "verificationStatus", "weeklySummaryEnabled") SELECT "age", "bio", "birthDate", "classYear", "createdAt", "department", "email", "fullName", "hobbies", "id", "instagramUrl", "intent", "interests", "isAdmin", "isBanned", "isFrozen", "isPremium", "language", "lastBirthdayNotifiedYear", "lastSeenAt", "lastWeeklySummaryAt", "linkedinUrl", "notifyMatches", "notifyMessages", "notifyPostActivity", "ocrAutoCheckPassed", "ocrExtractedText", "ocrProcessedAt", "passwordHash", "photoUrl", "premiumAutoRenew", "premiumSince", "premiumUntil", "profileVisibility", "rejectionReason", "showActivityStatus", "studentDocStatus", "studentDocUrl", "swipeEnabled", "theme", "tokenVersion", "twitterUrl", "universityId", "updatedAt", "verificationStatus", "weeklySummaryEnabled" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_universityId_idx" ON "User"("universityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Pass_toUserId_idx" ON "Pass"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Pass_fromUserId_toUserId_key" ON "Pass"("fromUserId", "toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_key" ON "MessageReaction"("messageId", "userId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "BannedWord_word_key" ON "BannedWord"("word");


-- Mevcut hesaplar kayıt anında okul e-postasıyla doğrulandı: yeniden doğrulama
-- süresi kayıt tarihinden başlar
UPDATE "User" SET "schoolEmailVerifiedAt" = "createdAt" WHERE "schoolEmailVerifiedAt" IS NULL;
