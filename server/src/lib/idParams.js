// Yol parametrelerindeki kimlikler (":id", ":matchId" ...) pozitif tam sayı
// olmalıdır. Aksi halde ("abc", "1.5", "-3", çok büyük sayılar) Prisma
// doğrulama hatası fırlatır ve istek 500 ile düşerdi; burada en baştan
// "bulunamadı" yanıtı verilir. Böylece hatalı adresler hata kaydını da kirletmez.
const NAMES = ['id', 'userId', 'matchId', 'messageId', 'pollId', 'eventId'];
const VALID = /^[1-9]\d{0,9}$/;

function numericIdParams(router) {
  for (const name of NAMES) {
    router.param(name, (req, res, next, value) => {
      if (VALID.test(value) && Number(value) <= 2147483647) return next();
      return res.status(404).json({ error: 'Bulunamadı.' });
    });
  }
  return router;
}

// Sorgu dizesindeki isteğe bağlı kimlik (ör. ?before=120): geçerli değilse null
function optionalId(value) {
  if (typeof value !== 'string' || !VALID.test(value)) return null;
  const n = Number(value);
  return n <= 2147483647 ? n : null;
}

module.exports = { numericIdParams, optionalId };
