-- Otomatik yenileme tercihi (kapatılınca premium süre sonuna kadar devam eder)
ALTER TABLE "User" ADD COLUMN "premiumAutoRenew" BOOLEAN NOT NULL DEFAULT true;
