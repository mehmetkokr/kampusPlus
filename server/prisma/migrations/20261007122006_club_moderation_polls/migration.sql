-- AlterTable
ALTER TABLE "ClubMembership" ADD COLUMN "mutedUntil" DATETIME;

-- CreateTable
CREATE TABLE "ClubPoll" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clubId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubPoll_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClubPoll_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ClubMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClubPoll_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClubPollOption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pollId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ClubPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ClubPoll" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClubPollVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pollId" INTEGER NOT NULL,
    "optionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ClubPoll" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClubPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ClubPollOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClubPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Club" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Sosyal',
    "iconEmoji" TEXT NOT NULL DEFAULT '👥',
    "universityId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatMode" TEXT NOT NULL DEFAULT 'everyone',
    "slowModeSeconds" INTEGER NOT NULL DEFAULT 0,
    "pinnedMessageId" INTEGER,
    CONSTRAINT "Club_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Club_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Club" ("category", "createdAt", "creatorId", "description", "iconEmoji", "id", "name", "universityId") SELECT "category", "createdAt", "creatorId", "description", "iconEmoji", "id", "name", "universityId" FROM "Club";
DROP TABLE "Club";
ALTER TABLE "new_Club" RENAME TO "Club";
CREATE INDEX "Club_universityId_idx" ON "Club"("universityId");
CREATE UNIQUE INDEX "Club_universityId_name_key" ON "Club"("universityId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ClubPoll_messageId_key" ON "ClubPoll"("messageId");

-- CreateIndex
CREATE INDEX "ClubPoll_clubId_idx" ON "ClubPoll"("clubId");

-- CreateIndex
CREATE INDEX "ClubPollOption_pollId_idx" ON "ClubPollOption"("pollId");

-- CreateIndex
CREATE INDEX "ClubPollVote_pollId_userId_idx" ON "ClubPollVote"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubPollVote_optionId_userId_key" ON "ClubPollVote"("optionId", "userId");
