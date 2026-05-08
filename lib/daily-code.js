const crypto = require('node:crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FALLBACK_SECRET = 'marble-roulette-daily-code-2026-kdy';

function getKstDateKey(now = new Date()) {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstNow.toISOString().slice(0, 10);
}

function makeDailyCode(dateKey = getKstDateKey()) {
  const secret = process.env.DAILY_CODE_SECRET || FALLBACK_SECRET;
  const hex = crypto.createHmac('sha256', secret).update(dateKey).digest('hex');
  const letterValue = Number.parseInt(hex.slice(0, 2), 16);
  const numberValue = Number.parseInt(hex.slice(2, 8), 16);
  const letter = ALPHABET[letterValue % ALPHABET.length];
  const digits = String(numberValue % 1000).padStart(3, '0');

  return `${letter}${digits}`;
}

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

module.exports = {
  getKstDateKey,
  makeDailyCode,
  normalizeCode,
};
