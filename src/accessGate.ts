const STORAGE_KEY = 'marble_roulette_access_date';

function getKstDateKey() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kstNow.toISOString().slice(0, 10);
}

function hasAccessToday() {
  return localStorage.getItem(STORAGE_KEY) === getKstDateKey();
}

function isLocalDevelopment() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function createGate() {
  if (hasAccessToday() || isLocalDevelopment()) return;

  const overlay = document.createElement('div');
  overlay.id = 'daily-code-gate';
  overlay.innerHTML = `
    <style>
      #daily-code-gate {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(8px);
        font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #daily-code-gate .gate-panel {
        width: min(420px, 100%);
        border: 1px solid #dbe3ef;
        border-radius: 14px;
        background: #ffffff;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
        padding: 28px;
        color: #162033;
      }
      #daily-code-gate h2 {
        margin: 0 0 8px;
        font-size: 1.55rem;
        line-height: 1.25;
        letter-spacing: 0;
      }
      #daily-code-gate p {
        margin: 0 0 18px;
        color: #667085;
        line-height: 1.6;
        font-size: 0.95rem;
      }
      #daily-code-gate label {
        display: block;
        margin-bottom: 8px;
        color: #334155;
        font-size: 0.86rem;
        font-weight: 800;
      }
      #daily-code-gate input {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 13px 14px;
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: 0;
        outline: none;
        text-transform: uppercase;
      }
      #daily-code-gate input:focus {
        border-color: #5851db;
        box-shadow: 0 0 0 3px rgba(88, 81, 219, 0.14);
      }
      #daily-code-gate button {
        width: 100%;
        min-height: 46px;
        border: 0;
        border-radius: 8px;
        margin-top: 12px;
        background: #5851db;
        color: #ffffff;
        font-size: 1rem;
        font-weight: 900;
        cursor: pointer;
      }
      #daily-code-gate button:disabled {
        cursor: wait;
        opacity: 0.72;
      }
      #daily-code-gate .gate-message {
        min-height: 22px;
        margin-top: 12px;
        color: #dc2626;
        font-size: 0.9rem;
        font-weight: 700;
      }
      #daily-code-gate .gate-hint {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid #edf1f7;
        color: #64748b;
        font-size: 0.82rem;
        line-height: 1.5;
      }
      #daily-code-gate .gate-hint a {
        color: #4f46e5;
        font-weight: 900;
        text-decoration: none;
      }
      #daily-code-gate .gate-hint a:hover {
        text-decoration: underline;
      }
    </style>
    <form class="gate-panel">
      <h2>오늘의 이용 코드를 입력해 주세요</h2>
      <p>네이버 블로그에 표시된 오늘의 코드를 입력하면 자리배치와 룰렛 기능을 자유롭게 사용할 수 있습니다.</p>
      <label for="daily-code-input">이용 코드</label>
      <input id="daily-code-input" name="code" placeholder="MR-0508-ABC123" autocomplete="one-time-code" />
      <button type="submit">확인하고 시작하기</button>
      <div class="gate-message" aria-live="polite"></div>
      <div class="gate-hint">
        코드는 매일 0시 기준으로 바뀝니다.<br />
        오늘의 코드 확인하기:
        <a href="https://blog.naver.com/math_dt" target="_blank" rel="noopener noreferrer">https://blog.naver.com/math_dt</a>
      </div>
    </form>
  `;

  const form = overlay.querySelector('form') as HTMLFormElement;
  const input = overlay.querySelector('input') as HTMLInputElement;
  const button = overlay.querySelector('button') as HTMLButtonElement;
  const message = overlay.querySelector('.gate-message') as HTMLDivElement;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = input.value.trim();
    if (!code) {
      message.textContent = '코드를 입력해 주세요.';
      input.focus();
      return;
    }

    button.disabled = true;
    message.textContent = '확인 중입니다...';

    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await response.json();

      if (result.ok) {
        localStorage.setItem(STORAGE_KEY, result.date || getKstDateKey());
        overlay.remove();
        return;
      }

      message.textContent = '오늘의 코드와 일치하지 않습니다.';
      input.select();
    } catch (error) {
      message.textContent = '코드 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    } finally {
      button.disabled = false;
    }
  });

  document.body.appendChild(overlay);
  input.focus();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createGate);
} else {
  createGate();
}
