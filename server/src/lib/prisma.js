// Prisma Client'ı tüm uygulamada tek bir bağlantı üzerinden kullanmak için
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
