-- Yeniden paylaşım (retweet) ve gönderi sahibinin izni.
-- Post tablosu yeniden kurulmaz; yalnızca sütun eklenir.
ALTER TABLE "Post" ADD COLUMN "allowRepost" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Repost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Repost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Repost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Repost_userId_createdAt_idx" ON "Repost"("userId", "createdAt");
CREATE UNIQUE INDEX "Repost_postId_userId_key" ON "Repost"("postId", "userId");
