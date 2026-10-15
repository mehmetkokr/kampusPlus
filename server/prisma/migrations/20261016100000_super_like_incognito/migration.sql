-- Süper Beğeni ve gizli mod (Premium)
ALTER TABLE "Like" ADD COLUMN "isSuper" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "incognito" BOOLEAN NOT NULL DEFAULT false;
