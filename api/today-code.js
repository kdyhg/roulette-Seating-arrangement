const { getKstDateKey, makeDailyCode } = require('../lib/daily-code');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = function handler(req, res) {
  const dateKey = getKstDateKey();
  const code = makeDailyCode(dateKey);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="170" height="130" viewBox="0 0 170 130" role="img" aria-label="오늘의 입장 코드 ${escapeXml(code)}">
  <rect width="170" height="130" rx="12" fill="#f8fafc"/>
  <rect x="8" y="8" width="154" height="114" rx="10" fill="#ffffff" stroke="#dbe3ef"/>
  <text x="85" y="34" text-anchor="middle" font-size="13" font-family="Arial, sans-serif" fill="#475569">오늘의 입장 코드</text>
  <text x="85" y="72" text-anchor="middle" font-size="20" font-weight="700" font-family="Arial, sans-serif" fill="#4f46e5">${escapeXml(code)}</text>
  <text x="85" y="96" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" fill="#64748b">${escapeXml(dateKey)}</text>
  <text x="85" y="112" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" fill="#009664">클릭해서 복사</text>
</svg>`.trim();

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.status(200).send(svg);
};
