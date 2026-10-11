// Özel dosyalar (sohbet ekleri, öğrenci belgesi) <img>/<audio>/<a> ile açıldığı
// için anahtar adreste taşınmak zorunda. Oturum anahtarının adreslere (ve
// oradan sunucu kayıtlarına, tarayıcı geçmişine) düşmemesi için yalnızca dosya
// açmaya yarayan, 24 saat geçerli ayrı bir anahtar kullanılır.
const jwt = require('jsonwebtoken');

const FILE_TOKEN_TTL = '24h';

function signFileToken(user) {
  return jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion, purpose: 'file' }, process.env.JWT_SECRET, { expiresIn: FILE_TOKEN_TTL });
}

module.exports = { signFileToken };
