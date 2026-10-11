// Testlerin geçici veritabanına erişimi (sunucunun Prisma istemcisiyle)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'server');
const requireServer = createRequire(path.join(SERVER_DIR, 'package.json'));

let prisma;
export function db() {
  if (!prisma) {
    process.env.DATABASE_URL = process.env.KP_E2E_DB;
    const { PrismaClient } = requireServer('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url: process.env.KP_E2E_DB } } });
  }
  return prisma;
}

export const bcrypt = requireServer('bcryptjs');
export const crypto = requireServer('crypto');

// Deneme hesapları (yalnızca bu geçici veritabanında bulunur)
export const PASSWORD = 'e2e-deneme-sifresi';
export const UNI_DOMAIN = 'e2e.edu.tr';
export const USERS = {
  ayse: { email: `ayse@${UNI_DOMAIN}`, fullName: 'Ayşe Deneme' },
  mert: { email: `mert@${UNI_DOMAIN}`, fullName: 'Mert Deneme' },
};
