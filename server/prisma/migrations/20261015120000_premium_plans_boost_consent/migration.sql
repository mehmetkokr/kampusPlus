-- Premium planları (haftalık/aylık/yıllık), boost ve KVKK onay kayıtları
ALTER TABLE "User" ADD COLUMN "premiumPlan" TEXT;
ALTER TABLE "User" ADD COLUMN "boostCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "boostUntil" DATETIME;
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "transferConsentAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "marketingConsentAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "consentVersion" TEXT;
ALTER TABLE "PaymentLog" ADD COLUMN "boostsGranted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PaymentLog" ADD COLUMN "consentAt" DATETIME;
CREATE INDEX "User_boostUntil_idx" ON "User"("boostUntil");
CREATE INDEX "Like_fromUserId_createdAt_idx" ON "Like"("fromUserId", "createdAt");
