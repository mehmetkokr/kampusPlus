-- Cinsiyet (Kart Modu eşleştirmesi) ve ücretli üyelerin Kart Modu kampüsü.
-- Tablo yeniden kurulmadan yalnızca sütun eklenir (mevcut veri olduğu gibi kalır).
ALTER TABLE "User" ADD COLUMN "gender" TEXT;
ALTER TABLE "User" ADD COLUMN "swipeUniversityId" INTEGER REFERENCES "University" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
