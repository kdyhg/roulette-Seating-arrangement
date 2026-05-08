const { getKstDateKey, makeDailyCode } = require('../lib/daily-code');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = function handler(req, res) {
  const dateKey = getKstDateKey();
  const code = makeDailyCode(dateKey);
  const safeCode = escapeHtml(code);
  const safeDate = escapeHtml(dateKey);
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>오늘의 입장 코드</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: 170px;
      height: 130px;
      margin: 0;
      overflow: hidden;
      background: transparent;
      font-family: Arial, sans-serif;
    }
    button {
      width: 170px;
      height: 130px;
      margin: 0;
      border: 0;
      border-radius: 12px;
      padding: 8px;
      background: #f8fafc;
      cursor: pointer;
      color: #162033;
      text-align: center;
    }
    .panel {
      display: flex;
      width: 154px;
      height: 114px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 9px;
      border: 1px solid #dbe3ef;
      border-radius: 10px;
      background: #ffffff;
    }
    .label {
      color: #475569;
      font-size: 13px;
      line-height: 1;
    }
    .code {
      color: #4f46e5;
      font-size: 20px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0;
    }
    .date, .status {
      color: #64748b;
      font-size: 11px;
      line-height: 1.2;
    }
    .status {
      min-height: 13px;
      color: #009664;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <button type="button" id="copyButton" data-code="${safeCode}" aria-label="오늘의 입장 코드 ${safeCode} 복사">
    <span class="panel">
      <span class="label">오늘의 입장 코드</span>
      <span class="code">${safeCode}</span>
      <span class="date">${safeDate}</span>
      <span class="status" id="copyStatus">클릭하면 복사됩니다</span>
    </span>
  </button>
  <script>
    const button = document.getElementById('copyButton');
    const status = document.getElementById('copyStatus');

    function fallbackCopy(text) {
      const input = document.createElement('input');
      input.value = text;
      input.setAttribute('readonly', 'readonly');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.focus();
      input.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(input);
      return ok;
    }

    async function copyCode() {
      const code = button.dataset.code;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(code);
        } else if (!fallbackCopy(code)) {
          throw new Error('copy failed');
        }
        status.textContent = '복사되었습니다';
      } catch (error) {
        status.textContent = '코드를 길게 눌러 복사';
      }

      window.setTimeout(() => {
        status.textContent = '클릭하면 복사됩니다';
      }, 1600);
    }

    button.addEventListener('click', copyCode);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.status(200).send(html);
};
