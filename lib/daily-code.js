const crypto = require('node:crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FALLBACK_SECRET = 'marble-roulette-daily-code-2026-kdy';

function getKstDateKey(now = new Date()) {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstNow.toISOString().slice(0, 10);
}

function makeDailyCode(dateKey = getKstDateKey()) {
  const secret = process.env.DAILY_CODE_SECRET || FALLBACK_SECRET;
  const hex = crypto.createHmac('sha256', secret).update(dateKey).digest('hex');
  let suffix = '';

  for (let i = 0; i < 6; i += 1) {
    const value = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    suffix += ALPHABET[value % ALPHABET.length];
  }

  return `MR-${dateKey.slice(5).replace('-', '')}-${suffix}`;
}

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

module.exports = {
  getKstDateKey,
  makeDailyCode,
  normalizeCode,
};
