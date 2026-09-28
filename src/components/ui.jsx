import { useState } from 'react';

export function CopyBtn({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn ghost sm"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text || '');
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {}
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`tab ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const Badge = ({ tone = 'neutral', children }) => <span className={`badge ${tone}`}>{children}</span>;

export const sevTone = (s) => ({ high: 'red', medium: 'amber', low: 'green' }[String(s).toLowerCase()] || 'neutral');

export function fitTone(score) {
  const n = Number(score);
  if (n >= 8) return 'green';
  if (n >= 5) return 'amber';
  return 'red';
}

export function Message({ title, subject, body }) {
  const full = subject ? `Subject: ${subject}\n\n${body}` : body;
  return (
    <div className="msg">
      <div className="msg-head">
        <span className="msg-title">{title}</span>
        <CopyBtn text={full} />
      </div>
      {subject && <div className="msg-subject">Subject: {subject}</div>}
      <pre className="msg-body">{body}</pre>
    </div>
  );
}

export function LineList({ items, numbered }) {
  if (!items?.length) return <p className="muted">Nothing generated.</p>;
  return (
    <ul className="lines">
      {items.map((t, i) => (
        <li key={i}>
          {numbered && <span className="num">{i + 1}</span>}
          <span className="line-text">{t}</span>
          <CopyBtn text={t} />
        </li>
      ))}
    </ul>
  );
}
