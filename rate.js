import { API_ORIGIN } from './vedomost.config.js';

const params = new URLSearchParams(location.hash.slice(1));
const token = params.get('t');
const preselect = params.get('s');
const root = document.querySelector('#rate-root');
const REASON_LABELS = {
  extraction_wrong: 'Данные извлечены неверно или неполно',
  wrong_section: 'Распознан не тот раздел / не те листы',
  format: 'Неудобный формат XLSX',
  late: 'Результат пришёл не вовремя',
  other: 'Другое'
};

let selectedScore = preselect === '1' ? 1 : (preselect === '0' ? -1 : null);
let selectedReason = '';

function node(tag, className = '', text = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

async function api(path, options = {}) {
  const res = await fetch(`${API_ORIGIN}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const wait = data.retry_after ? ` Повторите через ${data.retry_after} сек.` : '';
    throw new Error(`${data.message || 'Ошибка запроса.'}${wait}`);
  }
  return data;
}

function renderMessage(title, text = '', kind = '') {
  root.innerHTML = '';
  const box = node('div', `rate-state ${kind}`.trim());
  const heading = node('h2', '', title);
  box.append(heading);
  if (text) box.append(node('p', '', text));
  root.append(box);
}

function updateSubmit(submitBtn) {
  submitBtn.disabled = !(selectedScore === 1 || (selectedScore === -1 && selectedReason));
}

function renderReasons(container, reasons, submitBtn) {
  container.innerHTML = '';
  const title = node('p', 'rate-label', 'Что именно не подошло?');
  container.append(title);
  reasons.forEach(reason => {
    const label = node('label', 'reason-option');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'reason';
    input.value = reason;
    input.checked = selectedReason === reason;
    input.addEventListener('change', () => {
      selectedReason = reason;
      updateSubmit(submitBtn);
    });
    label.append(input, node('span', '', REASON_LABELS[reason] || reason));
    container.append(label);
  });
}

function renderForm(reasons) {
  root.innerHTML = '';
  const form = node('form', 'rate-form');
  const buttons = node('div', 'score-buttons');
  const up = node('button', 'score-button', 'Да, всё верно');
  const down = node('button', 'score-button', 'Есть замечания');
  up.type = 'button';
  down.type = 'button';
  up.setAttribute('aria-pressed', selectedScore === 1 ? 'true' : 'false');
  down.setAttribute('aria-pressed', selectedScore === -1 ? 'true' : 'false');
  buttons.append(up, down);

  const reasonsBox = node('div', 'reasons');
  const commentLabel = node('label', 'comment-field');
  const commentText = node('span', 'rate-label', 'Комментарий');
  const commentInput = document.createElement('textarea');
  commentInput.maxLength = 2000;
  commentInput.rows = 4;
  commentInput.placeholder = 'Можно одной строкой: что именно исправить или проверить';
  commentLabel.append(commentText, commentInput);

  const submit = node('button', 'btn btn-primary', 'Отправить оценку');
  submit.type = 'submit';
  const error = node('p', 'rate-error');

  function applyScore(score) {
    selectedScore = score;
    up.setAttribute('aria-pressed', score === 1 ? 'true' : 'false');
    down.setAttribute('aria-pressed', score === -1 ? 'true' : 'false');
    reasonsBox.hidden = score !== -1;
    commentLabel.hidden = score !== -1;
    updateSubmit(submit);
  }

  renderReasons(reasonsBox, reasons, submit);
  reasonsBox.hidden = selectedScore !== -1;
  commentLabel.hidden = selectedScore !== -1;
  updateSubmit(submit);

  up.addEventListener('click', () => applyScore(1));
  down.addEventListener('click', () => applyScore(-1));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    updateSubmit(submit);
    if (submit.disabled) return;
    submit.disabled = true;
    error.textContent = '';
    try {
      const body = {
        score: selectedScore,
        reason: selectedScore === -1 ? selectedReason : null,
        comment: commentInput.value
      };
      const result = await api('/api/rate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      renderMessage('Спасибо, оценка учтена', result.already_rated ? 'Мы уже приняли ответ по этой ведомости.' : '', 'ok');
    } catch (err) {
      error.textContent = err.message || 'Не удалось отправить оценку.';
      updateSubmit(submit);
    }
  });

  form.append(buttons, reasonsBox, commentLabel, submit, error);
  root.append(form);
}

async function init() {
  if (!token) {
    renderMessage('Ссылка оценки недействительна', 'Откройте ссылку из письма с результатом ведомости.', 'bad');
    return;
  }
  renderMessage('Проверяем ссылку...', '');
  try {
    const info = await api('/api/rate', { headers: { Authorization: `Bearer ${token}` } });
    if (info.already_rated) {
      renderMessage('Спасибо, оценка учтена', 'Мы уже приняли ответ по этой ведомости.', 'ok');
      return;
    }
    renderForm(info.reasons || Object.keys(REASON_LABELS));
  } catch (err) {
    renderMessage('Не удалось открыть форму', err.message || 'Попробуйте позже.', 'bad');
  }
}

init();
