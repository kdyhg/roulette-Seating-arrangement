const { getKstDateKey, makeDailyCode, normalizeCode } = require('../lib/daily-code');

function parseBody(value) {
  if (!value) return {};
  if (Buffer.isBuffer(value)) return parseBody(value.toString('utf8'));
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch (error) {
    return {};
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      resolve(parseBody(raw));
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, message: 'POST only' });
    return;
  }

  const body = req.body ? parseBody(req.body) : await readBody(req);
  const dateKey = getKstDateKey();
  const expectedCode = normalizeCode(makeDailyCode(dateKey));
  const inputCode = normalizeCode(body.code);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.status(200).json({
    ok: inputCode === expectedCode,
    date: dateKey,
  });
};
