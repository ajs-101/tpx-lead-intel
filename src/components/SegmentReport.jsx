import { useState } from 'react';
import { Tabs, Badge, sevTone, Message, LineList, CopyBtn } from './ui';
import { INTEL_TABS } from './LeadDetail';

const TABS = [{ id: 'overview', label: 'Overview' }, ...INTEL_TABS];

export default function SegmentReport({ segment, onRetry, onPickLead }) {
  const [tab, setTab] = useState('overview');
  const s = segment.result;

  return (
    <div className="panel detail">
      <div className="detail-head">
        <div>
          <h2>Whole list strategy</h2>
          <p className="muted">Segment level intel across every lead in the file</p>
        </div>
        {s?.overview?.avg_fit != null && (
          <div className="fit amber"><span className="fit-num">{s.overview.avg_fit}</span><span className="fit-label">/10 avg fit</span></div>
        )}
      </div>

      {segment.status === 'running' && <div className="empty"><div className="spinner" /> Building segment strategy…</div>}
      {segment.status === 'error' && (
        <div className="alert">
          <strong>Segment analysis failed.</strong> {segment.error}
          {onRetry && <button className="btn sm" onClick={onRetry}>Retry</button>}
        </div>
      )}

      {s && (
        <>
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <div className="tab-body">
            {tab === 'overview' && (
              <div className="stack">
                <div className="card hero"><p>{s.overview?.summary}</p></div>
                <div className="two-col">
                  <div className="card"><span className="label">Industries</span><div className="chips">{(s.overview?.industries || []).map((x) => <Badge key={x}>{x}</Badge>)}</div></div>
                  <div className="card"><span className="label">Roles</span><div className="chips">{(s.overview?.roles || []).map((x) => <Badge key={x}>{x}</Badge>)}</div></div>
                </div>
                <div className="card">
                  <span className="label">Priority leads</span>
                  {(s.priority_leads || []).map((p, i) => (
                    <button className="priority" key={i} onClick={() => onPickLead?.(p)}>
                      <strong>{p.name}</strong> <span className="muted">{p.company}</span>
                      <p className="small">{p.reason}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'pain' && (
              <div className="cards">
                {(s.top_pain_points || []).map((p, i) => (
                  <div className="card" key={i}>
                    <div className="card-top"><h4>{p.pain}</h4><Badge tone={sevTone(p.prevalence)}>{p.prevalence}</Badge></div>
                    <p className="muted small">{p.why}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'psych' && (
              <div className="cards">
                {(s.psychology_playbook || []).map((p, i) => (
                  <div className="card" key={i}>
                    <div className="card-top"><h4>{p.trigger}</h4></div>
                    <p><span className="label">When to use</span>{p.when_to_use}</p>
                    {p.example_line && <div className="quote"><span>“{p.example_line}”</span><CopyBtn text={p.example_line} /></div>}
                  </div>
                ))}
              </div>
            )}

            {tab === 'position' && s.positioning && (
              <div className="stack">
                <div className="card hero">
                  <span className="label">Core angle</span>
                  <h3>{s.positioning.core_angle}</h3>
                  <div className="quote"><span>{s.positioning.elevator_pitch}</span><CopyBtn text={s.positioning.elevator_pitch} /></div>
                </div>
                <div className="card">
                  <span className="label">By subsegment</span>
                  {(s.positioning.by_subsegment || []).map((p, i) => (
                    <div className="objection" key={i}><p className="obj">{p.segment}</p><p className="reframe">{p.angle}</p></div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'outreach' && (
              <div className="stack">
                {(s.outreach_templates || []).map((t, i) => (
                  <Message key={i} title={`${t.name} · ${t.channel}`} subject={t.subject} body={t.body} />
                ))}
              </div>
            )}

            {tab === 'hooks' && (
              <div className="two-col">
                <div><h4 className="col-title">Hooks</h4><LineList items={s.hooks} numbered /></div>
                <div><h4 className="col-title">CTAs</h4><LineList items={s.ctas} numbered /></div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
