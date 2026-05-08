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
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #f6f7fb;
      color: #162033;
      font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      line-height: 1.55;
    }
    main {
      width: min(420px, 100%);
      border: 1px solid #dbe3ef;
      border-radius: 14px;
      background: #ffffff;
      padding: 28px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
      text-align: center;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 1.55rem;
      letter-spacing: 0;
    }
    p {
      margin: 0 0 20px;
      color: #667085;
      font-size: 0.95rem;
    }
    .code {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 72px;
      border: 1px solid #dbe3ef;
      border-radius: 10px;
      background: #f8fafc;
      color: #4f46e5;
      font-size: 2.8rem;
      font-weight: 900;
      letter-spacing: 0;
      user-select: all;
    }
    .date {
      margin-top: 10px;
      color: #64748b;
      font-size: 0.82rem;
    }
    button {
      width: 100%;
      min-height: 48px;
      border: 0;
      border-radius: 8px;
      margin-top: 18px;
      background: #5851db;
      color: #ffffff;
      font-size: 1rem;
      font-weight: 900;
      cursor: pointer;
    }
    .status {
      min-height: 22px;
      margin-top: 12px;
      color: #009664;
      font-size: 0.9rem;
      font-weight: 800;
    }
    .hint {
      margin-top: 16px;
      color: #64748b;
      font-size: 0.82rem;
    }
  </style>
</head>
<body>
  <main>
    <h1>오늘의 입장 코드</h1>
    <p>아래 코드는 여러 서비스에서 공통 입장코드로 사용할 수 있습니다.</p>
    <div class="code" id="accessCode">${safeCode}</div>
    <div class="date">${safeDate} 기준</div>
    <button type="button" id="copyButton">코드 복사하기</button>
    <div class="status" id="copyStatus" aria-live="polite"></div>
    <div class="hint">복사가 되지 않으면 코드를 길게 누르거나 드래그해서 복사해 주세요.</div>
  </main>
  <script>
    const code = ${JSON.stringify(code)};
    const codeElement = document.getElementById('accessCode');
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
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(code);
        } else if (!fallbackCopy(code)) {
          throw new Error('copy failed');
        }
        status.textContent = '입장 코드가 복사되었습니다.';
      } catch (error) {
        status.textContent = '복사하지 못했습니다. 코드를 직접 선택해 주세요.';
        const range = document.createRange();
        range.selectNodeContents(codeElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
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
