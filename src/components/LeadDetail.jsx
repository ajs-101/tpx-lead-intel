import { useState } from 'react';
import { Tabs, Badge, sevTone, fitTone, Message, LineList, CopyBtn } from './ui';

export const INTEL_TABS = [
  { id: 'pain', label: 'Pain Points' },
  { id: 'psych', label: 'Dark Psychology' },
  { id: 'position', label: 'Positioning' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'hooks', label: 'Hooks & CTAs' },
];

export default function LeadDetail({ lead, onRetry }) {
  const [tab, setTab] = useState('pain');
  const r = lead.result;
  const d = lead.display;

  return (
    <div className="panel detail">
      <div className="detail-head">
        <div>
          <h2>{r?.lead?.name || d.name}</h2>
          <p className="muted">
            {[r?.lead?.role || d.role, r?.lead?.company || d.company, r?.lead?.industry].filter(Boolean).join(' · ')}
          </p>
        </div>
        {r?.lead?.fit_score != null && (
          <div className={`fit ${fitTone(r.lead.fit_score)}`}>
            <span className="fit-num">{r.lead.fit_score}</span>
            <span className="fit-label">/10 fit</span>
          </div>
        )}
      </div>

      {lead.status === 'error' && (
        <div className="alert">
          <strong>Analysis failed.</strong> {lead.error}
          {onRetry && <button className="btn sm" onClick={onRetry}>Retry</button>}
        </div>
      )}
      {(lead.status === 'pending' || lead.status === 'running') && (
        <div className="empty"><div className="spinner" /> {lead.status === 'running' ? 'Analyzing this lead…' : 'Queued'}</div>
      )}

      {r && (
        <>
          {r.lead?.fit_reason && <p className="fit-reason">{r.lead.fit_reason}</p>}
          <Tabs tabs={INTEL_TABS} active={tab} onChange={setTab} />
          <div className="tab-body">
            {tab === 'pain' && (
              <div className="cards">
                {(r.pain_points || []).map((p, i) => (
                  <div className="card" key={i}>
                    <div className="card-top"><h4>{p.pain}</h4><Badge tone={sevTone(p.severity)}>{p.severity}</Badge></div>
                    <p className="muted small">{p.evidence}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'psych' && (
              <div className="cards">
                {(r.psychology || []).map((p, i) => (
                  <div className="card" key={i}>
                    <div className="card-top"><h4>{p.trigger}</h4></div>
                    <p><span className="label">Why it lands</span>{p.why_it_works}</p>
                    <p><span className="label">How to use</span>{p.how_to_use}</p>
                    {p.example_line && (
                      <div className="quote">
                        <span>“{p.example_line}”</span>
                        <CopyBtn text={p.example_line} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'position' && r.positioning && (
              <div className="stack">
                <div className="card hero">
                  <span className="label">Strongest angle</span>
                  <h3>{r.positioning.angle}</h3>
                  <div className="quote"><span>{r.positioning.one_liner}</span><CopyBtn text={r.positioning.one_liner} /></div>
                </div>
                <div className="card">
                  <span className="label">Value props</span>
                  <ul className="bullets">{(r.positioning.value_props || []).map((v, i) => <li key={i}>{v}</li>)}</ul>
                </div>
                <div className="card">
                  <span className="label">Objections & reframes</span>
                  {(r.positioning.objections || []).map((o, i) => (
                    <div className="objection" key={i}>
                      <p className="obj">“{o.objection}”</p>
                      <p className="reframe">→ {o.reframe}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'outreach' && r.outreach && (
              <div className="stack">
                <Message title="Cold email" subject={r.outreach.email?.subject} body={r.outreach.email?.body} />
                <Message title="LinkedIn connection note" body={r.outreach.linkedin_connect} />
                <Message title="LinkedIn DM" body={r.outreach.linkedin_dm} />
                <Message title="Follow up (day 3 to 4)" subject={r.outreach.follow_up?.subject} body={r.outreach.follow_up?.body} />
              </div>
            )}

            {tab === 'hooks' && (
              <div className="two-col">
                <div><h4 className="col-title">Hooks</h4><LineList items={r.hooks} numbered /></div>
                <div><h4 className="col-title">CTAs</h4><LineList items={r.ctas} numbered /></div>
              </div>
            )}
          </div>
        </>
      )}

      <details className="raw">
        <summary>Original CSV row</summary>
        <table>
          <tbody>
            {Object.entries(lead.row).map(([k, v]) => (
              <tr key={k}><th>{k}</th><td>{String(v)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
