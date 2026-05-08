const { getKstDateKey, makeDailyCode, normalizeCode } = require('../lib/daily-code');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, message: 'POST only' });
    return;
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch (error) {
    body = {};
  }
  const dateKey = getKstDateKey();
  const expectedCode = normalizeCode(makeDailyCode(dateKey));
  const inputCode = normalizeCode(body.code);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.status(200).json({
    ok: inputCode === expectedCode,
    date: dateKey,
  });
};
