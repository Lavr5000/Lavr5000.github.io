/* index.app.js - precompiled from index.html inline JSX blocks 2-4.
 * Build: npx -p @babel/cli@7.29.7 -p @babel/core@7.29.7 -p @babel/preset-react@7.29.7
 *        babel blockN.jsx --presets @babel/preset-react   (build 2026-06-11)
 * Block 1 (data/CONTENT) remains inline in index.html.
 * Each block is an IIFE + window-export of its top-level functions to mirror
 * babel-standalone indirect-eval scoping (functions global, const isolated). */

/* ---- block 2 ---- */
;(function () {
const {
  useState,
  useRef,
  useEffect
} = React;

// Demo scenarios: voice message → generated letter (fictional names)
// ======= DEMOS (StroyOps, Auditor, IDGenerator) ==========================
// Fictional party names used intentionally for public demo.

const SCENARIOS_DATA = window.STROYOPS_SCENARIOS || {
  ru: [],
  en: []
};
function useTypewriter(text, enabled) {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (!enabled || !text) {
      setOut(text || '');
      return;
    }
    setOut('');
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      // write a chunk of 3–7 chars with tiny jitter
      const chunk = 3 + Math.floor(Math.random() * 5);
      i = Math.min(i + chunk, text.length);
      setOut(text.slice(0, i));
      if (i < text.length) setTimeout(tick, 14 + Math.random() * 18);
    };
    setTimeout(tick, 120);
    return () => {
      cancelled = true;
    };
  }, [text, enabled]);
  return out;
}
function TgMessage({
  m,
  t
}) {
  if (m.system && m.text) return /*#__PURE__*/React.createElement("div", {
    className: "tg-msg in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-bubble system"
  }, m.text));
  if (m.thinking) return /*#__PURE__*/React.createElement("div", {
    className: "tg-msg in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-typing"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null)));
  if (m.voice) {
    return /*#__PURE__*/React.createElement("div", {
      className: "tg-msg out"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tg-bubble",
      style: {
        padding: '8px 10px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "tg-voice"
    }, /*#__PURE__*/React.createElement("button", {
      className: "tg-voice-play",
      "aria-label": "play"
    }, "\u25B6"), /*#__PURE__*/React.createElement("div", {
      className: "tg-voice-wave playing"
    }, Array.from({
      length: 22
    }).map((_, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        height: 30 + i * 7 % 70 + '%'
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "tg-voice-meta"
    }, m.duration)), /*#__PURE__*/React.createElement("div", {
      className: "tg-bubble-meta"
    }, m.time, " \u2713\u2713")));
  }
  if (m.transcript) {
    return /*#__PURE__*/React.createElement("div", {
      className: "tg-msg in"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tg-bubble"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--accent-2)',
        marginBottom: 4,
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      }
    }, m.transcriptLabel), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        whiteSpace: 'pre-wrap'
      }
    }, m.transcript), /*#__PURE__*/React.createElement("div", {
      className: "tg-bubble-meta"
    }, m.time)));
  }
  return null;
}
function LetterCard({
  scenario,
  styleKey,
  setStyleKey,
  t,
  lang,
  onText
}) {
  const raw = scenario.letters[styleKey] || '';
  const text = useTypewriter(raw, true);
  const [copied, setCopied] = useState(false);
  const copyText = () => {
    try {
      navigator.clipboard.writeText(raw);
    } catch (e) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const styleLabels = lang === 'ru' ? {
    official: 'Официальный',
    soft: 'Согласовательный',
    hard: 'Жёсткий'
  } : {
    official: 'Official',
    soft: 'Soft',
    hard: 'Hard'
  };
  const styleCaption = lang === 'ru' ? 'Стиль' : 'Style';
  const doneLabel = lang === 'ru' ? 'готово' : 'ready';
  const actions = lang === 'ru' ? {
    send: 'Отправить',
    edit: 'Править',
    word: 'В Word',
    copy: 'Копировать',
    copied: 'Скопировано'
  } : {
    send: 'Send',
    edit: 'Edit',
    word: 'To Word',
    copy: 'Copy',
    copied: 'Copied'
  };
  const H = scenario.header;
  return /*#__PURE__*/React.createElement("div", {
    className: "letter"
  }, /*#__PURE__*/React.createElement("div", {
    className: "letter-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "letter-head-icon"
  }, "\u2709"), /*#__PURE__*/React.createElement("span", null, H.number, " \xB7 ", H.date), /*#__PURE__*/React.createElement("span", {
    className: "letter-head-tag"
  }, doneLabel)), /*#__PURE__*/React.createElement("div", {
    className: "letter-style"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ls-label"
  }, styleCaption), ['official', 'soft', 'hard'].map(k => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: styleKey === k ? 'on' : '',
    onClick: () => setStyleKey(k)
  }, styleLabels[k]))), /*#__PURE__*/React.createElement("div", {
    className: "letter-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lh"
  }, lang === 'ru' ? 'Кому' : 'To'), /*#__PURE__*/React.createElement("div", null, H.to), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-2)'
    }
  }, H.attn)), /*#__PURE__*/React.createElement("div", {
    className: "lrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lh"
  }, lang === 'ru' ? 'Тема' : 'Subject'), /*#__PURE__*/React.createElement("div", null, H.subject)), /*#__PURE__*/React.createElement("div", {
    className: "letter-text"
  }, text, /*#__PURE__*/React.createElement("span", {
    className: "cursor-blink"
  }, "\u258D"))), /*#__PURE__*/React.createElement("div", {
    className: "letter-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "letter-btn primary"
  }, "\u25B6 ", actions.send), /*#__PURE__*/React.createElement("button", {
    className: "letter-btn"
  }, "\u270E ", actions.edit), /*#__PURE__*/React.createElement("button", {
    className: "letter-btn"
  }, "W ", actions.word), /*#__PURE__*/React.createElement("button", {
    className: 'letter-btn' + (copied ? ' copied' : ''),
    onClick: copyText
  }, copied ? '✓ ' + actions.copied : '⧉ ' + actions.copy)));
}
function StroyOpsDemo({
  t,
  lang
}) {
  const scenarios = SCENARIOS_DATA[lang] && SCENARIOS_DATA[lang].length ? SCENARIOS_DATA[lang] : SCENARIOS_DATA.ru;
  const welcome = {
    role: 'bot',
    system: true,
    text: t.welcome
  };
  const [messages, setMessages] = useState([welcome]);
  const [busy, setBusy] = useState(false);
  const [activeChat, setActiveChat] = useState(0);
  const [activeScenario, setActiveScenario] = useState(null);
  const [styleKey, setStyleKey] = useState('official');
  const scrollRef = useRef(null);
  useEffect(() => {
    setMessages([{
      role: 'bot',
      system: true,
      text: t.welcome
    }]);
    setActiveScenario(null);
  }, [lang, t.welcome]);
  const scrollToBottom = smooth => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  };
  const scrollLetterIntoView = smooth => {
    const body = scrollRef.current;
    if (!body) return;
    const letter = body.querySelector('.letter');
    if (!letter) return;
    const top = letter.offsetTop - 12;
    body.scrollTo({
      top,
      behavior: smooth ? 'smooth' : 'auto'
    });
  };
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, busy]);
  useEffect(() => {
    if (activeScenario) {
      // Wait one frame for .letter to mount, then scroll to its top so user sees the style switcher
      requestAnimationFrame(() => scrollLetterIntoView(true));
    }
  }, [activeScenario]);
  const runScenario = sc => {
    if (busy) return;
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches && scrollRef.current) {
      setTimeout(() => scrollRef.current && scrollRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      }), 80);
    }
    setBusy(true);
    setActiveScenario(null);
    setMessages([welcome, {
      role: 'user',
      voice: true,
      duration: sc.duration,
      time: '15:42',
      tag: sc.tag
    }]);
    setTimeout(() => setMessages(m => [...m, {
      role: 'bot',
      thinking: true
    }]), 500);
    setTimeout(() => {
      setMessages(m => [...m.filter(x => !x.thinking), {
        role: 'bot',
        transcript: sc.transcript,
        transcriptLabel: lang === 'ru' ? 'Расшифровка' : 'Transcript',
        time: '15:42'
      }, {
        role: 'bot',
        thinking: true
      }]);
    }, 1600);
    setTimeout(() => {
      setMessages(m => m.filter(x => !x.thinking));
      setActiveScenario(sc);
      setStyleKey('official');
      setBusy(false);
    }, 3200);
  };
  const reset = () => {
    setMessages([welcome]);
    setActiveScenario(null);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "tg-shell"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "tg-side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-side-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-side-title"
  }, "Chats")), /*#__PURE__*/React.createElement("div", {
    className: "tg-side-search"
  }, "Search"), t.chats.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: 'tg-chat' + (i === activeChat ? ' on' : ''),
    onClick: () => setActiveChat(i)
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-ava",
    style: {
      background: c.color
    }
  }, c.avatar), /*#__PURE__*/React.createElement("div", {
    className: "tg-chat-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-chat-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tg-chat-name"
  }, c.name), /*#__PURE__*/React.createElement("span", {
    className: "tg-chat-time"
  }, c.time)), /*#__PURE__*/React.createElement("div", {
    className: "tg-chat-bot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tg-chat-preview"
  }, c.preview), c.unread > 0 && /*#__PURE__*/React.createElement("span", {
    className: "tg-chat-badge"
  }, c.unread)))))), /*#__PURE__*/React.createElement("div", {
    className: "tg-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-ava",
    style: {
      background: t.chats[0].color
    }
  }, t.chats[0].avatar), /*#__PURE__*/React.createElement("div", {
    className: "tg-head-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-head-name"
  }, t.botName, " ", /*#__PURE__*/React.createElement("span", {
    className: "tg-check"
  }, "\u2713")), /*#__PURE__*/React.createElement("div", {
    className: "tg-head-sub"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot-live"
  }), " ", t.onlineLabel, " \xB7 ", t.botHandle)), /*#__PURE__*/React.createElement("div", {
    className: "tg-head-icons"
  }, /*#__PURE__*/React.createElement("span", null, "\u2315"), /*#__PURE__*/React.createElement("span", null, "\u22EF"))), /*#__PURE__*/React.createElement("div", {
    className: "tg-body",
    ref: scrollRef
  }, /*#__PURE__*/React.createElement("div", {
    className: "tg-day"
  }, lang === 'ru' ? 'Сегодня' : 'Today'), messages.map((m, i) => /*#__PURE__*/React.createElement(TgMessage, {
    key: i,
    m: m,
    t: t
  })), activeScenario && /*#__PURE__*/React.createElement("div", {
    className: "tg-msg in",
    style: {
      maxWidth: '94%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement(LetterCard, {
    scenario: activeScenario,
    styleKey: styleKey,
    setStyleKey: setStyleKey,
    t: t,
    lang: lang,
    onText: scrollToBottom
  })))), /*#__PURE__*/React.createElement("div", {
    className: "tg-input"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tg-input-icon"
  }, "\uFF0B"), /*#__PURE__*/React.createElement("div", {
    className: "tg-input-field"
  }, t.inputPlaceholder), /*#__PURE__*/React.createElement("span", {
    className: "tg-input-icon"
  }, "\u263A"), /*#__PURE__*/React.createElement("button", {
    className: "tg-mic",
    "aria-label": "mic"
  }, "\u25CF")), /*#__PURE__*/React.createElement("div", {
    className: "tg-presets"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preset-label"
  }, t.tryLabel), scenarios.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    className: "chip",
    onClick: () => runScenario(s),
    disabled: busy
  }, /*#__PURE__*/React.createElement("span", {
    className: "chip-icon"
  }, "\u25B6"), " ", s.label, " \xB7 ", s.duration)), /*#__PURE__*/React.createElement("button", {
    className: "chip",
    onClick: reset,
    disabled: busy
  }, lang === 'ru' ? '⟲ Сбросить' : '⟲ Reset'))));
}

// --- AuditorDemo ---------------------------------------------------------
function AuditorDemo({
  t,
  lang
}) {
  const [step, setStep] = useState('checklist');
  const phoneRef = useRef(null);
  const stepIdx = t.steps.findIndex(s => s.id === step);
  const progressPct = (stepIdx + 1) / t.steps.length * 100;
  const handleStepClick = id => {
    setStep(id);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches && phoneRef.current) {
      setTimeout(() => phoneRef.current && phoneRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      }), 50);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "auditor-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aud-side"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "aud-title"
  }, t.title), /*#__PURE__*/React.createElement("p", {
    className: "aud-sub"
  }, t.subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--text-3)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }, t.tryLabel), /*#__PURE__*/React.createElement("div", {
    className: "aud-steps"
  }, t.steps.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    className: 'aud-step' + (step === s.id ? ' on' : ''),
    onClick: () => handleStepClick(s.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "aud-step-code"
  }, s.code), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "aud-step-name"
  }, s.name), /*#__PURE__*/React.createElement("div", {
    className: "aud-step-hint"
  }, s.hint))))), /*#__PURE__*/React.createElement("div", {
    className: "aud-meta-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aud-meta-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mk"
  }, lang === 'ru' ? 'Площадь' : 'Area'), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, "58.3 \u043C\xB2")), /*#__PURE__*/React.createElement("div", {
    className: "aud-meta-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mk"
  }, lang === 'ru' ? 'Время' : 'Duration'), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, lang === 'ru' ? '40 мин' : '40 min')), /*#__PURE__*/React.createElement("div", {
    className: "aud-meta-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mk"
  }, lang === 'ru' ? 'Пункты' : 'Items'), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, "48")), /*#__PURE__*/React.createElement("div", {
    className: "aud-meta-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mk"
  }, lang === 'ru' ? 'Платформа' : 'Platform'), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, "RuStore")))), /*#__PURE__*/React.createElement("div", {
    className: "phone",
    ref: phoneRef
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-status"
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", null, "\u25CF\u25CF\u25CF \u25AE 87%")), /*#__PURE__*/React.createElement("div", {
    className: "phone-nav"
  }, /*#__PURE__*/React.createElement("span", {
    className: "phone-back"
  }, "\u2039"), /*#__PURE__*/React.createElement("div", {
    className: "phone-nav-title"
  }, step === 'checklist' ? t.checklist.header : step === 'defect' ? t.defect.header : t.report.header), /*#__PURE__*/React.createElement("div", {
    className: "phone-nav-meta"
  }, step === 'checklist' ? t.checklist.progress : '')), /*#__PURE__*/React.createElement("div", {
    className: "phone-prog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-prog-bar",
    style: {
      width: progressPct + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "phone-body"
  }, step === 'checklist' && /*#__PURE__*/React.createElement(ChecklistScreen, {
    c: t.checklist,
    onDefectClick: () => setStep('defect'),
    lang: lang
  }), step === 'defect' && /*#__PURE__*/React.createElement(DefectScreen, {
    d: t.defect,
    lang: lang
  }), step === 'report' && /*#__PURE__*/React.createElement(ReportScreen, {
    r: t.report,
    lang: lang
  })), /*#__PURE__*/React.createElement("div", {
    className: "phone-dock"
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-dock-dot"
  }, "\u25C9"), /*#__PURE__*/React.createElement("div", {
    className: "phone-dock-dot"
  }, "\u25C8"), /*#__PURE__*/React.createElement("div", {
    className: "phone-dock-dot"
  }, "\u25CE")))));
}
function ChecklistScreen({
  c,
  onDefectClick,
  lang
}) {
  // group by category
  const cats = {};
  c.items.forEach(it => {
    (cats[it.cat] = cats[it.cat] || []).push(it);
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--text-3)',
      marginBottom: 8
    }
  }, c.meta), Object.entries(cats).map(([cat, items]) => /*#__PURE__*/React.createElement("div", {
    key: cat
  }, /*#__PURE__*/React.createElement("div", {
    className: "cl-cat"
  }, cat), items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "cl-item",
    onClick: it.status === 'defect' ? onDefectClick : undefined,
    style: it.status === 'defect' ? {
      cursor: 'pointer'
    } : {}
  }, /*#__PURE__*/React.createElement("div", {
    className: 'cl-check ' + it.status
  }), /*#__PURE__*/React.createElement("div", {
    className: "cl-name"
  }, it.name), it.count && /*#__PURE__*/React.createElement("div", {
    className: "cl-count"
  }, it.count))))));
}
function DefectScreen({
  d,
  lang
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "dp-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dp-hero-label"
  }, d.photoLabel), /*#__PURE__*/React.createElement("div", {
    className: "dp-hero-tag"
  }, d.severity), /*#__PURE__*/React.createElement("div", {
    className: "dp-hero-crack",
    style: {
      top: '45%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "dp-hero-crack",
    style: {
      top: '55%',
      width: '60%',
      opacity: 0.5
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "dp-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dp-cat"
  }, d.cat), /*#__PURE__*/React.createElement("div", {
    className: "dp-norm"
  }, "\u2691 ", d.norm)), /*#__PURE__*/React.createElement("div", {
    className: "dp-plan"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dp-plan-label"
  }, d.planLabel, " \xB7 ", d.room), /*#__PURE__*/React.createElement("svg", {
    className: "dp-plan-svg",
    viewBox: "0 0 200 120",
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "196",
    height: "116",
    fill: "none",
    stroke: "#2a2a33",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "50",
    x2: "120",
    y2: "50",
    stroke: "#2a2a33",
    strokeWidth: "1.2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "120",
    y1: "2",
    x2: "120",
    y2: "50",
    stroke: "#2a2a33",
    strokeWidth: "1.2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "6",
    width: "112",
    height: "42",
    fill: "rgba(124,92,255,0.04)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "54",
    width: "112",
    height: "62",
    fill: "rgba(0,212,255,0.04)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "124",
    y: "6",
    width: "72",
    height: "110",
    fill: "rgba(125,216,125,0.04)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "60",
    cy: "78",
    r: "6",
    fill: "#F87171",
    opacity: "0.25"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "60",
    cy: "78",
    r: "3",
    fill: "#F87171"
  }), /*#__PURE__*/React.createElement("text", {
    x: "70",
    y: "82",
    fontSize: "7",
    fontFamily: "monospace",
    fill: "#F87171"
  }, "#06"))), /*#__PURE__*/React.createElement("div", {
    className: "dp-note"
  }, d.note), /*#__PURE__*/React.createElement("div", {
    className: "dp-fields"
  }, d.fields.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "dp-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk"
  }, f.k), /*#__PURE__*/React.createElement("div", {
    className: "dv"
  }, f.v)))));
}
function ReportScreen({
  r,
  lang
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "rp-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rp-title"
  }, r.header), /*#__PURE__*/React.createElement("div", {
    className: "rp-meta"
  }, r.meta)), /*#__PURE__*/React.createElement("div", {
    className: "rp-sum"
  }, r.sum.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "rp-sum-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rp-sum-k"
  }, s.k), /*#__PURE__*/React.createElement("div", {
    className: 'rp-sum-v' + (i === 1 ? ' crit' : i === 2 ? ' sig' : '')
  }, s.v)))), /*#__PURE__*/React.createElement("div", {
    className: "rp-list"
  }, r.list.map((x, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "rp-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rp-row-n"
  }, x.n), /*#__PURE__*/React.createElement("span", {
    className: "rp-row-t"
  }, x.t), /*#__PURE__*/React.createElement("span", {
    className: 'rp-row-sev ' + x.sev
  }, "\u25CF ", x.sev)))), /*#__PURE__*/React.createElement("div", {
    className: "rp-act"
  }, /*#__PURE__*/React.createElement("button", {
    className: "primary"
  }, "\u25A3 ", r.actions.export), /*#__PURE__*/React.createElement("button", null, "\u2192 ", r.actions.send)));
}

// --- IDGeneratorDemo -----------------------------------------------------
function IDGeneratorDemo({
  t,
  lang
}) {
  const [filled, setFilled] = useState({
    contract: false,
    estimate: false,
    ks2: false
  });
  const [state, setState] = useState('idle'); // idle | running | done
  const [progress, setProgress] = useState({});
  const [stageIdx, setStageIdx] = useState(-1);
  const toggle = id => {
    if (state === 'running') return;
    setFilled(f => ({
      ...f,
      [id]: !f[id]
    }));
  };
  const canRun = filled.contract && filled.estimate && state !== 'running';
  const run = () => {
    if (!canRun) return;
    setState('running');
    setStageIdx(0);
    setProgress({});
    const total = t.stages.length;
    let i = 0;
    const runStage = k => {
      const id = t.stages[k].id;
      let pct = 0;
      const iv = setInterval(() => {
        pct += 6 + Math.random() * 10;
        if (pct >= 100) {
          pct = 100;
          clearInterval(iv);
          setProgress(p => ({
            ...p,
            [id]: pct
          }));
          if (k + 1 < total) {
            setStageIdx(k + 1);
            setTimeout(() => runStage(k + 1), 260);
          } else {
            setTimeout(() => {
              setState('done');
              setStageIdx(total);
            }, 420);
          }
        } else {
          setProgress(p => ({
            ...p,
            [id]: pct
          }));
        }
      }, 60);
    };
    runStage(0);
  };
  const reset = () => {
    setFilled({
      contract: false,
      estimate: false,
      ks2: false
    });
    setState('idle');
    setStageIdx(-1);
    setProgress({});
  };
  const stateLabel = state === 'running' ? t.running : state === 'done' ? t.done : lang === 'ru' ? 'ожидание входа' : 'awaiting input';
  return /*#__PURE__*/React.createElement("div", {
    className: "idg-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "idg-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "idg-head-left"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "aud-title"
  }, t.title), /*#__PURE__*/React.createElement("p", {
    className: "aud-sub"
  }, t.subtitle)), /*#__PURE__*/React.createElement("div", {
    className: 'idg-state ' + state
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), " ", stateLabel)), /*#__PURE__*/React.createElement("div", {
    className: "idg-hint"
  }, /*#__PURE__*/React.createElement("span", {
    className: "idg-hint-icon"
  }, "\u25B6"), /*#__PURE__*/React.createElement("span", {
    className: "idg-hint-text"
  }, t.tryLabel)), /*#__PURE__*/React.createElement("div", {
    className: 'dropzones' + (filled[t.dropzones[0].id] || filled[t.dropzones[1].id] || filled[t.dropzones[2].id] ? ' touched' : '')
  }, t.dropzones.map((dz, idx) => {
    const anyTouched = filled[t.dropzones[0].id] || filled[t.dropzones[1].id] || filled[t.dropzones[2].id];
    const isFirstEmpty = !anyTouched && idx === 0;
    return /*#__PURE__*/React.createElement("div", {
      key: dz.id,
      className: 'dz' + (filled[dz.id] ? ' filled' : '') + (isFirstEmpty ? ' empty-cta' : ''),
      onClick: () => toggle(dz.id)
    }, /*#__PURE__*/React.createElement("div", {
      className: "dz-label"
    }, /*#__PURE__*/React.createElement("span", null, dz.label), /*#__PURE__*/React.createElement("span", {
      className: "dz-accept"
    }, dz.accept)), /*#__PURE__*/React.createElement("div", {
      className: "dz-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dz-icon"
    }, filled[dz.id] ? '✓' : '⇧'), filled[dz.id] ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "dz-file-name"
    }, dz.sample), /*#__PURE__*/React.createElement("div", {
      className: "dz-file-size"
    }, dz.size)) : /*#__PURE__*/React.createElement("div", {
      className: "dz-empty"
    }, /*#__PURE__*/React.createElement("span", {
      className: "dz-empty-cta"
    }, lang === 'ru' ? '▶ Загрузить демо-файл' : '▶ Load demo file'), /*#__PURE__*/React.createElement("span", {
      className: "dz-empty-sub"
    }, lang === 'ru' ? 'или перетащите сюда' : 'or drop here'))));
  })), /*#__PURE__*/React.createElement("div", {
    className: "idg-run-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: 'btn ' + (canRun ? 'btn-primary' : 'btn-ghost'),
    disabled: !canRun,
    onClick: run,
    style: {
      opacity: canRun ? 1 : 0.5
    }
  }, "\u25B6 ", t.run), state !== 'idle' && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: reset
  }, "\u27F2 ", lang === 'ru' ? 'Сбросить' : 'Reset')), /*#__PURE__*/React.createElement("div", {
    className: "idg-pipeline"
  }, t.stages.map((s, i) => {
    const pct = progress[s.id] || 0;
    const cls = stageIdx === i && state === 'running' ? 'running' : pct >= 100 ? 'done' : '';
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      className: 'pipe-stage ' + cls
    }, /*#__PURE__*/React.createElement("div", {
      className: "pipe-top"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pipe-check",
      "data-n": i + 1
    }), /*#__PURE__*/React.createElement("div", {
      className: "pipe-name"
    }, s.name)), /*#__PURE__*/React.createElement("div", {
      className: "pipe-detail"
    }, s.detail), /*#__PURE__*/React.createElement("div", {
      className: "pipe-bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pipe-bar-fill",
      style: {
        width: pct + '%'
      }
    })));
  })), /*#__PURE__*/React.createElement("div", {
    className: "idg-outputs"
  }, t.outputs.map((o, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: 'out-card' + (state === 'done' ? ' ready' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "out-code"
  }, o.code), /*#__PURE__*/React.createElement("div", {
    className: "out-name"
  }, o.name), /*#__PURE__*/React.createElement("div", {
    className: "out-count"
  }, o.count)))));
}
Object.assign(window, {
  StroyOpsDemo,
  AuditorDemo,
  IDGeneratorDemo
});
;Object.assign(window, { useTypewriter, TgMessage, LetterCard, StroyOpsDemo, AuditorDemo, ChecklistScreen, DefectScreen, ReportScreen, IDGeneratorDemo });
})();

/* ---- block 3 ---- */
;(function () {
const {
  useState: useStateS,
  useEffect: useEffectS,
  useRef: useRefS
} = React;
function Robot() {
  const [mvReady, setMvReady] = useStateS(false);
  const [mvError, setMvError] = useStateS(false);
  const hostRef = useRefS(null);
  useEffectS(() => {
    const host = hostRef.current;
    if (!host) return;
    const glbUrl = window.ROBOT_GLB_URL || 'robot.glb';
    let cancelled = false;
    let el = null;
    const mount = () => {
      if (cancelled) return;
      host.innerHTML = `
        <model-viewer
          src="${glbUrl}"
          alt="AI robot"
          auto-rotate
          auto-rotate-delay="0"
          rotation-per-second="18deg"
          camera-controls
          disable-zoom
          interaction-prompt="none"
          loading="eager"
          reveal="auto"
          shadow-intensity="1.1"
          exposure="1.05"
          environment-image="neutral"
          camera-orbit="0deg 82deg 2.4m"
          min-camera-orbit="auto 70deg auto"
          max-camera-orbit="auto 95deg auto"
          field-of-view="28deg"
          class="mv-robot"
          style="width:100%;height:100%;background:transparent;--poster-color:transparent;"
        ></model-viewer>
      `;
      el = host.querySelector('model-viewer');
      if (!el) return;
      const forceShow = () => {
        if (!el.shadowRoot) return;
        if (el.shadowRoot.querySelector('style[data-force-show]')) return;
        const s = document.createElement('style');
        s.setAttribute('data-force-show', '1');
        s.textContent = 'canvas:not(#webgl-canvas){display:none !important;} canvas#webgl-canvas{display:block !important;background:transparent !important;} :host{background:transparent !important;} #default-poster{display:none !important;background:transparent !important;opacity:0 !important;visibility:hidden !important;} .slot.poster{display:none !important;}';
        el.shadowRoot.appendChild(s);
      };
      forceShow();
      setTimeout(forceShow, 0);
      setTimeout(forceShow, 500);
      setTimeout(forceShow, 1500);
      el.addEventListener('load', () => {
        if (cancelled) return;
        setMvReady(true);
        el.classList.add('ready');
        forceShow();
        try {
          if (typeof el.dismissPoster === 'function') el.dismissPoster();
        } catch (e) {}
      });
      el.addEventListener('error', () => {
        if (!cancelled) setMvError(true);
      });
    };
    // Wait for model-viewer custom element to be defined, then mount
    if (window.customElements && customElements.get('model-viewer')) {
      mount();
    } else if (window.customElements && customElements.whenDefined) {
      customElements.whenDefined('model-viewer').then(() => {
        if (!cancelled) mount();
      });
      // Fallback timeout: if the component never registers in 12s, show error
      setTimeout(() => {
        if (!cancelled && !customElements.get('model-viewer')) setMvError(true);
      }, 12000);
    } else {
      mount();
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "robot-stage"
  }, /*#__PURE__*/React.createElement("div", {
    className: "robot-glow"
  }), /*#__PURE__*/React.createElement("div", {
    ref: hostRef,
    className: 'mv-host' + (mvReady ? ' ready' : ''),
    style: {
      position: 'absolute',
      inset: 0,
      display: mvError ? 'none' : 'block'
    }
  }), mvError && /*#__PURE__*/React.createElement("div", {
    className: "mv-error-state"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mv-error-icon"
  }, "!"), /*#__PURE__*/React.createElement("div", {
    className: "mv-error-text"
  }, "3D-\u043C\u043E\u0434\u0435\u043B\u044C \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u0430\u0441\u044C")));
}
function Nav({
  t,
  lang,
  setLang
}) {
  const [scrolled, setScrolled] = useStateS(false);
  useEffectS(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, {
      passive: true
    });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return /*#__PURE__*/React.createElement("nav", {
    className: 'nav' + (scrolled ? ' nav-scrolled' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "nav-inner"
  }, /*#__PURE__*/React.createElement("a", {
    href: "/",
    className: "nav-logo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "logo-mark"
  }, /*#__PURE__*/React.createElement("span", {
    className: "logo-fold"
  }), /*#__PURE__*/React.createElement("span", {
    className: "logo-check"
  }, "\u2713")), /*#__PURE__*/React.createElement("span", {
    className: "logo-text"
  }, "AI Vibes")), /*#__PURE__*/React.createElement("div", {
    className: "nav-links"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#about"
  }, t.nav.about), /*#__PURE__*/React.createElement("a", {
    href: "#projects"
  }, t.nav.projects), /*#__PURE__*/React.createElement("a", {
    href: "#demo"
  }, t.nav.demo), /*#__PURE__*/React.createElement("a", {
    href: "#stack"
  }, t.nav.stack), /*#__PURE__*/React.createElement("a", {
    href: "#pricing"
  }, t.nav.pricing), /*#__PURE__*/React.createElement("a", {
    href: "/"
  }, t.nav.products), /*#__PURE__*/React.createElement("a", {
    href: "#contact"
  }, t.nav.contact)), /*#__PURE__*/React.createElement("div", {
    className: "nav-actions"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lang-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: lang === 'ru' ? 'on' : '',
    onClick: () => setLang('ru')
  }, "RU"), /*#__PURE__*/React.createElement("button", {
    className: lang === 'en' ? 'on' : '',
    onClick: () => setLang('en')
  }, "EN")), /*#__PURE__*/React.createElement("a", {
    href: "#contact",
    className: "btn btn-primary btn-sm"
  }, t.hero.ctaSecondary, " \u2192"))));
}
function Hero({
  t,
  variant
}) {
  if (variant === 'B') {
    return /*#__PURE__*/React.createElement("header", {
      className: "hero hero-b",
      id: "top"
    }, /*#__PURE__*/React.createElement("div", {
      className: "grid-bg"
    }), /*#__PURE__*/React.createElement("div", {
      className: "hero-inner center"
    }, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pulse"
    }), " ", t.hero.eyebrow), /*#__PURE__*/React.createElement("h1", {
      className: "display display-xl"
    }, t.hero.title[0], /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      className: "accent-gradient"
    }, t.hero.title[1])), /*#__PURE__*/React.createElement("p", {
      className: "hero-sub"
    }, t.hero.subtitle), /*#__PURE__*/React.createElement("div", {
      className: "hero-ctas"
    }, /*#__PURE__*/React.createElement("a", {
      href: "#projects",
      className: "btn btn-primary"
    }, t.hero.ctaPrimary, " \u2192"), /*#__PURE__*/React.createElement("a", {
      href: "#contact",
      className: "btn btn-ghost"
    }, t.hero.ctaSecondary)), /*#__PURE__*/React.createElement(SystemDiagram, {
      wide: true,
      t: t
    }), /*#__PURE__*/React.createElement(Metrics, {
      t: t
    })));
  }
  return /*#__PURE__*/React.createElement("header", {
    className: "hero hero-a",
    id: "top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid-bg"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pulse"
  }), " ", t.hero.eyebrow), /*#__PURE__*/React.createElement("h1", {
    className: "display"
  }, t.hero.title[0], /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "accent-gradient"
  }, t.hero.title[1])), /*#__PURE__*/React.createElement("p", {
    className: "hero-sub"
  }, t.hero.subtitle), /*#__PURE__*/React.createElement("div", {
    className: "hero-ctas"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#projects",
    className: "btn btn-primary"
  }, t.hero.ctaPrimary, " \u2192"), /*#__PURE__*/React.createElement("a", {
    href: "#contact",
    className: "btn btn-ghost"
  }, t.hero.ctaSecondary)), /*#__PURE__*/React.createElement(Metrics, {
    t: t
  })), /*#__PURE__*/React.createElement("div", {
    className: "hero-right"
  }, /*#__PURE__*/React.createElement(Robot, null))));
}
function Metrics({
  t
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "metrics"
  }, t.hero.metricValues.map((v, i) => /*#__PURE__*/React.createElement("div", {
    className: "metric",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "metric-val"
  }, v), /*#__PURE__*/React.createElement("div", {
    className: "metric-label"
  }, t.hero.metricLabels[i]))));
}
function SystemDiagram({
  wide,
  t
}) {
  const d = t.diagram;
  return /*#__PURE__*/React.createElement("div", {
    className: 'sys-diagram' + (wide ? ' wide' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "sys-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sys-dot"
  }), " ", d.head, /*#__PURE__*/React.createElement("span", {
    className: "sys-badge"
  }, "live")), /*#__PURE__*/React.createElement("div", {
    className: "sys-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "node node-in"
  }, /*#__PURE__*/React.createElement("span", {
    className: "node-code"
  }, "\u0412\u0425\u041E\u0414"), /*#__PURE__*/React.createElement("span", {
    className: "node-name"
  }, d.in), /*#__PURE__*/React.createElement("span", {
    className: "node-sub"
  }, d.inSub)), /*#__PURE__*/React.createElement("div", {
    className: "flow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flow-line"
  }), /*#__PURE__*/React.createElement("span", {
    className: "flow-dot"
  })), /*#__PURE__*/React.createElement("div", {
    className: "node node-core"
  }, /*#__PURE__*/React.createElement("span", {
    className: "node-code"
  }, "AI"), /*#__PURE__*/React.createElement("span", {
    className: "node-name"
  }, d.core), /*#__PURE__*/React.createElement("span", {
    className: "node-sub"
  }, d.coreSub)), /*#__PURE__*/React.createElement("div", {
    className: "flow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flow-line"
  }), /*#__PURE__*/React.createElement("span", {
    className: "flow-dot d2"
  })), /*#__PURE__*/React.createElement("div", {
    className: "node-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "node node-out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "node-code"
  }, "01"), /*#__PURE__*/React.createElement("span", {
    className: "node-name"
  }, d.out1)), /*#__PURE__*/React.createElement("div", {
    className: "node node-out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "node-code"
  }, "02"), /*#__PURE__*/React.createElement("span", {
    className: "node-name"
  }, d.out2)), /*#__PURE__*/React.createElement("div", {
    className: "node node-out"
  }, /*#__PURE__*/React.createElement("span", {
    className: "node-code"
  }, "03"), /*#__PURE__*/React.createElement("span", {
    className: "node-name"
  }, d.out3)))));
}
function About({
  t
}) {
  const isRu = document.documentElement.lang !== 'en';
  return /*#__PURE__*/React.createElement("section", {
    className: "section",
    id: "about"
  }, /*#__PURE__*/React.createElement(Kicker, {
    text: t.about.kicker
  }), /*#__PURE__*/React.createElement("div", {
    className: "about-layout"
  }, /*#__PURE__*/React.createElement("div", {
    className: "about-copy"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, t.about.title), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, t.about.body), /*#__PURE__*/React.createElement("div", {
    className: "pillars"
  }, t.about.pillars.map((p, i) => /*#__PURE__*/React.createElement("div", {
    className: "pillar",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "pillar-label"
  }, p.label), /*#__PURE__*/React.createElement("div", {
    className: "pillar-text"
  }, p.text))))), /*#__PURE__*/React.createElement("aside", {
    className: "person-card",
    "aria-label": isRu ? "\u0414\u0435\u043D\u0438\u0441 \u041B\u0430\u0432\u0440\u043E\u0432" : "Denis Lavrov"
  }, /*#__PURE__*/React.createElement("div", {
    className: "person-photo"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/denis-portrait.png",
    alt: isRu ? "\u0414\u0435\u043D\u0438\u0441 \u041B\u0430\u0432\u0440\u043E\u0432" : "Denis Lavrov",
    loading: "lazy"
  })), /*#__PURE__*/React.createElement("div", {
    className: "person-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "person-kicker"
  }, "Portfolio"), /*#__PURE__*/React.createElement("div", {
    className: "person-name"
  }, isRu ? "\u0414\u0435\u043D\u0438\u0441 \u041B\u0430\u0432\u0440\u043E\u0432" : "Denis Lavrov"), /*#__PURE__*/React.createElement("div", {
    className: "person-role"
  }, isRu ? "\u0421\u0442\u0440\u043E\u0439\u043A\u0430 \xB7 \u041F\u0422\u041E \xB7 AI-\u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u044F" : "Construction \xB7 PTO \xB7 AI automation")))));
}
function statusClass(s) {
  const k = (s || '').toString().toLowerCase();
  if (k === 'запущено' || k === 'live' || k === 'production' || k === 'продакшн') return 's-production';
  if (k === 'в работе' || k === 'active' || k === 'beta') return 's-beta';
  if (k.includes('разработ') || k.includes('development')) return 's-dev';
  if (k.includes('план') || k.includes('planned')) return 's-planned';
  return 's-planned';
}
function Projects({
  t,
  labels
}) {
  const [active, setActive] = useStateS(0);
  const [userInteracted, setUserInteracted] = useStateS(false);
  const detailRef = useRefS(null);
  const item = t.projects.items[active];
  const total = t.projects.items.length;
  const pad = n => String(n).padStart(2, '0');
  const scrollToDetail = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches && detailRef.current) {
      setTimeout(() => detailRef.current && detailRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      }), 50);
    }
  };
  const go = i => {
    setActive((i + total) % total);
    setUserInteracted(true);
    scrollToDetail();
  };
  const status = item.status || '';
  const statusK = statusClass(status);
  return /*#__PURE__*/React.createElement("section", {
    className: "section",
    id: "projects"
  }, /*#__PURE__*/React.createElement(Kicker, {
    text: t.projects.kicker
  }), /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, t.projects.title), /*#__PURE__*/React.createElement("div", {
    className: "projects-wrap"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "projects-list"
  }, t.projects.items.map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: 'project-row' + (i === active ? ' active' : '') + (!userInteracted ? ' hint-pulse' : ''),
    onClick: () => {
      setActive(i);
      setUserInteracted(true);
      scrollToDetail();
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "project-code"
  }, p.code), /*#__PURE__*/React.createElement("span", {
    className: "project-name"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "project-tag"
  }, p.tag), /*#__PURE__*/React.createElement("span", {
    className: 'project-status ' + statusClass(p.status)
  }, p.status), /*#__PURE__*/React.createElement("span", {
    className: "project-arrow"
  }, "\u2192")))), /*#__PURE__*/React.createElement("div", {
    className: 'projects-hint' + (userInteracted ? ' hidden' : '')
  }, labels.selectHint)), /*#__PURE__*/React.createElement("div", {
    className: "project-detail bento",
    key: active,
    ref: detailRef
  }, /*#__PURE__*/React.createElement("div", {
    className: "bento-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "project-code-lg"
  }, item.code), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h3", {
    className: "project-title"
  }, item.name), /*#__PURE__*/React.createElement("div", {
    className: "project-tag"
  }, item.tag)), /*#__PURE__*/React.createElement("div", {
    className: "bento-status"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'st-pill ' + statusK
  }, /*#__PURE__*/React.createElement("span", {
    className: "st-dot"
  }), status), /*#__PURE__*/React.createElement("div", {
    className: "project-progress"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pp-cur"
  }, pad(active + 1)), " / ", pad(total)))), /*#__PURE__*/React.createElement("div", {
    className: "bento-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bento-card bento-problem"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bento-label"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bl-mark bm-red"
  }), labels.problem), /*#__PURE__*/React.createElement("div", {
    className: "bento-text"
  }, item.problem)), /*#__PURE__*/React.createElement("div", {
    className: "bento-card bento-solution"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bento-label"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bl-mark bm-accent"
  }), labels.solution), /*#__PURE__*/React.createElement("div", {
    className: "bento-text"
  }, item.solution)), /*#__PURE__*/React.createElement("div", {
    className: "bento-card bento-result"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bento-label"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bl-mark bm-green"
  }), labels.result), /*#__PURE__*/React.createElement("div", {
    className: "bento-text"
  }, item.result))), /*#__PURE__*/React.createElement("div", {
    className: "project-nav-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "pn-btn",
    onClick: () => go(active - 1)
  }, "\u2039 ", labels.prev), /*#__PURE__*/React.createElement("button", {
    className: "pn-btn",
    onClick: () => go(active + 1)
  }, labels.next, " \u203A")))));
}
function ProjectBlock({
  label,
  text,
  color
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'pb pb-' + color
  }, /*#__PURE__*/React.createElement("div", {
    className: "pb-label"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pb-mark"
  }), label), /*#__PURE__*/React.createElement("div", {
    className: "pb-text"
  }, text));
}
function SystemThinking({
  t
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "section",
    id: "system"
  }, /*#__PURE__*/React.createElement(Kicker, {
    text: t.system.kicker
  }), /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, t.system.title), /*#__PURE__*/React.createElement("div", {
    className: "principles"
  }, t.system.items.map((p, i) => /*#__PURE__*/React.createElement("div", {
    className: "principle",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "principle-n"
  }, p.n), /*#__PURE__*/React.createElement("div", {
    className: "principle-name"
  }, p.name), /*#__PURE__*/React.createElement("div", {
    className: "principle-text"
  }, p.text)))));
}
function Stack({
  t
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "section",
    id: "stack"
  }, /*#__PURE__*/React.createElement(Kicker, {
    text: t.stack.kicker
  }), /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, t.stack.title), /*#__PURE__*/React.createElement("div", {
    className: "stack-grid"
  }, t.stack.groups.map((g, i) => /*#__PURE__*/React.createElement("div", {
    className: "stack-group",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "stack-group-name"
  }, g.name), /*#__PURE__*/React.createElement("ul", {
    className: "stack-list"
  }, g.items.map((x, j) => /*#__PURE__*/React.createElement("li", {
    key: j
  }, /*#__PURE__*/React.createElement("span", {
    className: "stack-dot"
  }), " ", x)))))));
}
function Gov({
  t
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "section",
    id: "gov"
  }, /*#__PURE__*/React.createElement(Kicker, {
    text: t.gov.kicker
  }), /*#__PURE__*/React.createElement("div", {
    className: "gov-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gov-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, t.gov.title), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, t.gov.body)), /*#__PURE__*/React.createElement("div", {
    className: "gov-right"
  }, /*#__PURE__*/React.createElement("ul", {
    className: "gov-list"
  }, t.gov.points.map((p, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "gov-num"
  }, "0", i + 1), /*#__PURE__*/React.createElement("span", null, p)))))));
}
function DemoSection({
  t,
  lang
}) {
  const [tab, setTab] = useStateS('stroyops');
  const d = t.demo;
  return /*#__PURE__*/React.createElement("section", {
    className: "section demo-section",
    id: "demo"
  }, /*#__PURE__*/React.createElement(Kicker, {
    text: d.kicker
  }), /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, d.title), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, d.subtitle), /*#__PURE__*/React.createElement("div", {
    className: "demo-tabs"
  }, d.tabs.map(x => /*#__PURE__*/React.createElement("button", {
    key: x.id,
    className: 'demo-tab' + (tab === x.id ? ' on' : ''),
    onClick: () => setTab(x.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "demo-tab-code"
  }, x.code), /*#__PURE__*/React.createElement("div", {
    className: "demo-tab-text"
  }, /*#__PURE__*/React.createElement("span", {
    className: "demo-tab-name"
  }, x.name), /*#__PURE__*/React.createElement("span", {
    className: "demo-tab-hint"
  }, x.hint))))), tab === 'stroyops' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "demo-sub"
  }, d.stroyops.subtitle), /*#__PURE__*/React.createElement(StroyOpsDemo, {
    t: d.stroyops,
    lang: lang
  })), tab === 'auditor' && /*#__PURE__*/React.createElement(AuditorDemo, {
    t: d.auditor,
    lang: lang
  }), tab === 'idgen' && /*#__PURE__*/React.createElement(IDGeneratorDemo, {
    t: d.idgen,
    lang: lang
  }), /*#__PURE__*/React.createElement("div", {
    className: "demo-cta-row"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#contact",
    className: "btn btn-primary"
  }, lang === 'ru' ? 'Обсудить внедрение' : 'Discuss adoption', " \u2192"), /*#__PURE__*/React.createElement("a", {
    href: "#projects",
    className: "btn btn-ghost"
  }, lang === 'ru' ? 'Все проекты' : 'All projects'), /*#__PURE__*/React.createElement("span", {
    className: "note"
  }, lang === 'ru' ? '// реальные продакшн-системы, имена контрагентов условные' : '// real production systems, party names are illustrative')));
}
function Pricing({
  t
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "section",
    id: "pricing"
  }, /*#__PURE__*/React.createElement(Kicker, {
    text: t.pricing.kicker
  }), /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, t.pricing.title), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, t.pricing.subtitle), /*#__PURE__*/React.createElement("div", {
    className: "pricing-grid"
  }, t.pricing.plans.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: 'price-card' + (p.featured ? ' featured' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "price-tier"
  }, p.tier), /*#__PURE__*/React.createElement("div", {
    className: "price-val"
  }, p.price, /*#__PURE__*/React.createElement("span", {
    className: "rub"
  }, "\u0442\u044B\u0441. \u20BD")), /*#__PURE__*/React.createElement("div", {
    className: "price-sub"
  }, p.sub, " \xB7 ", p.hint), /*#__PURE__*/React.createElement("ul", {
    className: "price-features"
  }, p.features.map((f, j) => /*#__PURE__*/React.createElement("li", {
    key: j
  }, f))), /*#__PURE__*/React.createElement("a", {
    className: "price-cta",
    href: "#contact"
  }, /*#__PURE__*/React.createElement("span", null, p.cta), /*#__PURE__*/React.createElement("span", {
    className: "arr"
  }, "\u2192"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-3)',
      marginTop: 24,
      fontFamily: 'var(--font-mono)'
    }
  }, t.pricing.note));
}
function Contact({
  t
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "section contact-section",
    id: "contact"
  }, /*#__PURE__*/React.createElement(Kicker, {
    text: t.contact.kicker
  }), /*#__PURE__*/React.createElement("div", {
    className: "contact-wrap"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h2 contact-title"
  }, t.contact.title), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, t.contact.body), /*#__PURE__*/React.createElement("div", {
    className: "contact-rows"
  }, /*#__PURE__*/React.createElement("a", {
    className: "contact-row",
    href: 'mailto:' + t.contact.email
  }, /*#__PURE__*/React.createElement("span", {
    className: "cr-label"
  }, "Email"), /*#__PURE__*/React.createElement("span", {
    className: "cr-val"
  }, t.contact.email), /*#__PURE__*/React.createElement("span", {
    className: "cr-arrow"
  }, "\u2192")), /*#__PURE__*/React.createElement("a", {
    className: "contact-row",
    href: 'https://t.me/' + t.contact.telegram.replace('@', ''),
    target: "_blank",
    rel: "noreferrer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cr-label"
  }, "Telegram"), /*#__PURE__*/React.createElement("span", {
    className: "cr-val"
  }, t.contact.telegram), /*#__PURE__*/React.createElement("span", {
    className: "cr-arrow"
  }, "\u2192")), /*#__PURE__*/React.createElement("a", {
    className: "contact-row",
    href: 'https://' + t.contact.github,
    target: "_blank",
    rel: "noreferrer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cr-label"
  }, "GitHub"), /*#__PURE__*/React.createElement("span", {
    className: "cr-val"
  }, t.contact.github), /*#__PURE__*/React.createElement("span", {
    className: "cr-arrow"
  }, "\u2192"))), /*#__PURE__*/React.createElement("a", {
    className: "btn btn-primary btn-lg",
    href: 'https://t.me/' + t.contact.telegram.replace('@', ''),
    target: "_blank",
    rel: "noreferrer"
  }, t.contact.cta, " \u2192")));
}
function Footer({
  t
}) {
  return /*#__PURE__*/React.createElement("footer", {
    className: "footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-inner"
  }, /*#__PURE__*/React.createElement("div", null, t.footer), /*#__PURE__*/React.createElement("div", {
    className: "footer-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot-live"
  }), " \u043E\u0442\u043A\u0440\u044B\u0442 \u043A \u0437\u0430\u0434\u0430\u0447\u0430\u043C")));
}
function Kicker({
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "kicker"
  }, text);
}
Object.assign(window, {
  Nav,
  Hero,
  About,
  Projects,
  SystemThinking,
  Stack,
  Gov,
  DemoSection,
  Pricing,
  Contact,
  Footer
});
;Object.assign(window, { Robot, Nav, Hero, Metrics, SystemDiagram, About, statusClass, Projects, ProjectBlock, SystemThinking, Stack, Gov, DemoSection, Pricing, Contact, Footer, Kicker });
})();

/* ---- block 4 ---- */
;(function () {
const {
  useState,
  useEffect
} = React;
const ACCENTS = [{
  hex: 'var(--brand)',
  soft: 'var(--brand-wash)',
  glow: 'rgba(14,143,99,0.22)',
  pair: 'var(--brand-ink)'
}, {
  hex: '#7C5CFF',
  soft: 'rgba(124,92,255,0.12)',
  glow: 'rgba(124,92,255,0.35)',
  pair: '#A78BFA'
}, {
  hex: '#00D4FF',
  soft: 'rgba(0,212,255,0.12)',
  glow: 'rgba(0,212,255,0.35)',
  pair: '#7DE8FF'
}, {
  hex: '#7DD87D',
  soft: 'rgba(125,216,125,0.12)',
  glow: 'rgba(125,216,125,0.35)',
  pair: '#A3E8A3'
}];
const LABELS = {
  ru: {
    problem: 'Проблема',
    solution: 'Решение',
    result: 'Результат',
    selectHint: '← выберите проект',
    prev: 'Предыдущий',
    next: 'Следующий'
  },
  en: {
    problem: 'Problem',
    solution: 'Solution',
    result: 'Result',
    selectHint: '← select a project',
    prev: 'Previous',
    next: 'Next'
  }
};
function applyAccent(hex) {
  const a = ACCENTS.find(x => x.hex.toLowerCase() === hex.toLowerCase()) || ACCENTS[0];
  document.documentElement.style.setProperty('--accent', a.hex);
  document.documentElement.style.setProperty('--accent-2', a.pair);
  document.documentElement.style.setProperty('--accent-soft', a.soft);
  document.documentElement.style.setProperty('--accent-glow', a.glow);
}
function App() {
  const [lang, setLang] = useState(TWEAK_DEFAULTS.lang || 'ru');
  const [variant, setVariant] = useState(TWEAK_DEFAULTS.heroVariant || 'B');
  const [accent, setAccent] = useState(TWEAK_DEFAULTS.accent || 'var(--brand)');
  const [tweaksOpen, setTweaksOpen] = useState(false);
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    const onMessage = e => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const persist = (key, value) => {
    try {
      window.parent.postMessage({
        type: '__edit_mode_set_keys',
        edits: {
          [key]: value
        }
      }, '*');
    } catch (err) {}
  };
  const t = CONTENT[lang];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Nav, {
    t: t,
    lang: lang,
    setLang: l => {
      setLang(l);
      persist('lang', l);
    }
  }), /*#__PURE__*/React.createElement(Hero, {
    t: t,
    variant: variant
  }), /*#__PURE__*/React.createElement(About, {
    t: t
  }), /*#__PURE__*/React.createElement(Projects, {
    t: t,
    labels: LABELS[lang]
  }), /*#__PURE__*/React.createElement(DemoSection, {
    t: t,
    lang: lang
  }), /*#__PURE__*/React.createElement(SystemThinking, {
    t: t
  }), /*#__PURE__*/React.createElement(Stack, {
    t: t
  }), /*#__PURE__*/React.createElement(Pricing, {
    t: t
  }), /*#__PURE__*/React.createElement(Gov, {
    t: t
  }), /*#__PURE__*/React.createElement(Contact, {
    t: t
  }), /*#__PURE__*/React.createElement(Footer, {
    t: t
  }), tweaksOpen && /*#__PURE__*/React.createElement("div", {
    className: "tweaks-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tweaks-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sys-dot"
  }), " Tweaks"), /*#__PURE__*/React.createElement("div", {
    className: "tweak-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tweak-label"
  }, "\u042F\u0437\u044B\u043A"), /*#__PURE__*/React.createElement("div", {
    className: "tweak-seg"
  }, ['ru', 'en'].map(l => /*#__PURE__*/React.createElement("button", {
    key: l,
    className: lang === l ? 'on' : '',
    onClick: () => {
      setLang(l);
      persist('lang', l);
    }
  }, l.toUpperCase())))), /*#__PURE__*/React.createElement("div", {
    className: "tweak-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tweak-label"
  }, "Hero"), /*#__PURE__*/React.createElement("div", {
    className: "tweak-seg"
  }, ['A', 'B'].map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    className: variant === v ? 'on' : '',
    onClick: () => {
      setVariant(v);
      persist('heroVariant', v);
    }
  }, v === 'A' ? 'Сплит' : 'Центр')))), /*#__PURE__*/React.createElement("div", {
    className: "tweak-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tweak-label"
  }, "\u0410\u043A\u0446\u0435\u043D\u0442"), /*#__PURE__*/React.createElement("div", {
    className: "tweak-swatches"
  }, ACCENTS.map(a => /*#__PURE__*/React.createElement("button", {
    key: a.hex,
    className: 'tweak-swatch' + (accent.toLowerCase() === a.hex.toLowerCase() ? ' on' : ''),
    style: {
      background: a.hex
    },
    onClick: () => {
      setAccent(a.hex);
      persist('accent', a.hex);
    },
    "aria-label": a.hex
  }))))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
;Object.assign(window, { applyAccent, App });
})();

