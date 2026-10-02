// Üniversite listesini döndürür - kayıt formunda seçim için kullanılır
const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const universities = await prisma.university.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, emailDomain: true },
    });
    res.json(universities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Üniversiteler alınamadı.' });
  }
});

module.exports = router;
