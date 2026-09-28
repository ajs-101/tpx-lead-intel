import { useMemo, useRef, useState } from 'react';
import { parseCsv, displayFields } from './lib/csv';
import { analyzeLead, analyzeSegment, pool } from './lib/api';
import { createRun, saveLead, updateRun, loadRun, firebaseEnabled } from './lib/firebase';
import { leadsToCsv, segmentToMarkdown, download } from './lib/export';
import LeadDetail from './components/LeadDetail';
import SegmentReport from './components/SegmentReport';
import Settings, { loadOffer } from './components/Settings';
import History from './components/History';
import { fitTone } from './components/ui';

const SEGMENT_ID = '__segment__';

export default function App() {
  const [view, setView] = useState('new'); // new | history
  const [stage, setStage] = useState('upload'); // upload | configure | results
  const [offer, setOffer] = useState(loadOffer);
  const [showSettings, setShowSettings] = useState(false);

  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [parseErr, setParseErr] = useState('');
  const [dragging, setDragging] = useState(false);

  const [opts, setOpts] = useState({ perLead: true, segment: true, max: 50, concurrency: 3 });

  const [leads, setLeads] = useState([]);
  const [segment, setSegment] = useState({ status: 'idle', result: null, error: '' });
  const [selected, setSelected] = useState(SEGMENT_ID);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(null);
  const [search, setSearch] = useState('');
  const [sortByFit, setSortByFit] = useState(false);
  const stopRef = useRef(false);
  const fileInput = useRef(null);

  // ---------- upload ----------
  async function handleFile(file) {
    if (!file) return;
    setParseErr('');
    try {
      const { rows, columns } = await parseCsv(file);
      setFileName(file.name);
      setRows(rows);
      setColumns(columns);
      setOpts((o) => ({ ...o, max: Math.min(rows.length, 50) }));
      setStage('configure');
    } catch (e) {
      setParseErr(e.message || 'Could not read that CSV');
    }
  }

  // ---------- run ----------
  const patchLead = (i, patch) =>
    setLeads((prev) => prev.map((l) => (l.index === i ? { ...l, ...patch } : l)));

  async function runLead(lead, id) {
    patchLead(lead.index, { status: 'running', error: null });
    try {
      const result = await analyzeLead(lead.row, offer);
      patchLead(lead.index, { status: 'done', result });
      saveLead(id, lead.index, { row: lead.row, display: lead.display, status: 'done', result, error: null }).catch(() => {});
      return true;
    } catch (e) {
      patchLead(lead.index, { status: 'error', error: e.message });
      saveLead(id, lead.index, { row: lead.row, display: lead.display, status: 'error', result: null, error: e.message }).catch(() => {});
      return false;
    }
  }

  async function runSegment(id) {
    setSegment({ status: 'running', result: null, error: '' });
    try {
      const result = await analyzeSegment(rows, columns, offer);
      setSegment({ status: 'done', result, error: '' });
      updateRun(id, { segment: result }).catch(() => {});
    } catch (e) {
      setSegment({ status: 'error', result: null, error: e.message });
    }
  }

  async function start() {
    const max = Math.max(1, Math.min(Number(opts.max) || 1, rows.length));
    const initial = opts.perLead
      ? rows.slice(0, max).map((row, index) => ({ index, row, display: displayFields(row), status: 'pending', result: null, error: null }))
      : [];
    setLeads(initial);
    setSegment({ status: opts.segment ? 'pending' : 'idle', result: null, error: '' });
    setSelected(opts.segment ? SEGMENT_ID : 0);
    setStage('results');
    setRunning(true);
    stopRef.current = false;

    let id = null;
    try {
      id = await createRun({ fileName, columns, total: initial.length, offer });
    } catch (e) {
      console.warn('History not saved:', e.message);
    }
    setRunId(id);

    let done = 0;
    let failed = 0;
    const jobs = [];
    if (opts.segment) jobs.push(runSegment(id));
    if (opts.perLead) {
      jobs.push(
        pool(initial, async (lead) => {
          const ok = await runLead(lead, id);
          ok ? done++ : failed++;
          if ((done + failed) % 5 === 0) updateRun(id, { done, failed }).catch(() => {});
        }, Number(opts.concurrency) || 3, () => stopRef.current)
      );
    }
    await Promise.all(jobs);
    updateRun(id, { done, failed, status: stopRef.current ? 'stopped' : 'complete' }).catch(() => {});
    setRunning(false);
  }

  async function openRun(id) {
    const run = await loadRun(id);
    if (!run) return;
    setFileName(run.fileName);
    setColumns(run.columns || []);
    setRows(run.leads.map((l) => l.row));
    setLeads(run.leads.map((l, index) => ({ ...l, index })));
    setSegment(run.segment ? { status: 'done', result: run.segment, error: '' } : { status: 'idle', result: null, error: '' });
    setSelected(run.segment ? SEGMENT_ID : 0);
    setRunId(id);
    setView('new');
    setStage('results');
  }

  function reset() {
    stopRef.current = true;
    setStage('upload');
    setRows([]);
    setLeads([]);
    setSegment({ status: 'idle', result: null, error: '' });
    setRunId(null);
  }

  // ---------- derived ----------
  const stats = useMemo(() => {
    const done = leads.filter((l) => l.status === 'done').length;
    const err = leads.filter((l) => l.status === 'error').length;
    const segDone = segment.status === 'done' || segment.status === 'error' ? 1 : 0;
    const segTotal = segment.status === 'idle' ? 0 : 1;
    const total = leads.length + segTotal;
    const pct = total ? Math.round(((done + err + segDone) / total) * 100) : 0;
    return { done, err, pct };
  }, [leads, segment]);

  const visibleLeads = useMemo(() => {
    const q = search.toLowerCase();
    let list = leads.filter((l) =>
      !q || [l.display.name, l.display.company, l.display.role].join(' ').toLowerCase().includes(q)
    );
    if (sortByFit) list = [...list].sort((a, b) => (b.result?.lead?.fit_score ?? -1) - (a.result?.lead?.fit_score ?? -1));
    return list;
  }, [leads, search, sortByFit]);

  const selectedLead = selected === SEGMENT_ID ? null : leads.find((l) => l.index === selected);

  const pickPriority = (p) => {
    const n = (p.name || '').toLowerCase();
    const hit = leads.find((l) => (l.result?.lead?.name || l.display.name).toLowerCase() === n)
      || leads.find((l) => n && (l.result?.lead?.name || l.display.name).toLowerCase().includes(n.split(' ')[0]));
    if (hit) setSelected(hit.index);
  };

  const base = fileName.replace(/\.csv$/i, '') || 'leads';

  // ---------- render ----------
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">TPX</div>
          <div>
            <h1>Lead Intel Agent</h1>
            <p className="muted small">Pain points · psychology · positioning · outreach · hooks</p>
          </div>
        </div>
        <nav className="row">
          <button className={`btn ghost ${view === 'new' ? 'on' : ''}`} onClick={() => setView('new')}>Analyze</button>
          <button className={`btn ghost ${view === 'history' ? 'on' : ''}`} onClick={() => setView('history')} title={firebaseEnabled ? '' : 'Firebase not configured'}>History</button>
          <button className="btn ghost" onClick={() => setShowSettings(true)}>Settings</button>
        </nav>
      </header>

      {view === 'history' && <main className="main"><History onOpen={openRun} /></main>}

      {view === 'new' && stage === 'upload' && (
        <main className="main center">
          <div
            className={`drop panel ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileInput.current?.click()}
          >
            <div className="drop-icon">⇪</div>
            <h2>Drop your leads CSV</h2>
            <p className="muted">Any columns work: name, company, title, industry, website, LinkedIn, notes. More context means sharper intel.</p>
            <button className="btn primary">Choose file</button>
            <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => handleFile(e.target.files[0])} />
            {parseErr && <div className="alert">{parseErr}</div>}
          </div>
        </main>
      )}

      {view === 'new' && stage === 'configure' && (
        <main className="main">
          <div className="panel">
            <div className="row between wrap">
              <div>
                <h2>{fileName}</h2>
                <p className="muted">{rows.length} leads · {columns.length} columns</p>
              </div>
              <button className="btn ghost" onClick={reset}>Choose another file</button>
            </div>

            <div className="preview">
              <table>
                <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{columns.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="options">
              <label className="check"><input type="checkbox" checked={opts.segment} onChange={(e) => setOpts({ ...opts, segment: e.target.checked })} /> Whole list strategy</label>
              <label className="check"><input type="checkbox" checked={opts.perLead} onChange={(e) => setOpts({ ...opts, perLead: e.target.checked })} /> Per lead intel + messages</label>
              {opts.perLead && (
                <>
                  <label className="field inline"><span>Leads to analyze</span>
                    <input type="number" min={1} max={rows.length} value={opts.max} onChange={(e) => setOpts({ ...opts, max: e.target.value })} />
                    <small className="muted">of {rows.length}</small>
                  </label>
                  <label className="field inline"><span>Parallel</span>
                    <select value={opts.concurrency} onChange={(e) => setOpts({ ...opts, concurrency: e.target.value })}>
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </label>
                </>
              )}
            </div>

            <div className="row end">
              <button className="btn primary lg" disabled={!opts.perLead && !opts.segment} onClick={start}>
                Run agent
              </button>
            </div>
          </div>
        </main>
      )}

      {view === 'new' && stage === 'results' && (
        <main className="main results">
          <div className="panel runbar">
            <div className="runbar-info">
              <strong>{fileName}</strong>
              <span className="muted small">
                {leads.length ? `${stats.done}/${leads.length} leads done` : 'Segment only'}
                {stats.err ? ` · ${stats.err} failed` : ''}
                {runId ? ' · saved to history' : ''}
              </span>
              <div className="progress"><div style={{ width: `${stats.pct}%` }} /></div>
            </div>
            <div className="row wrap">
              {running && <button className="btn ghost" onClick={() => { stopRef.current = true; }}>Stop</button>}
              {!running && stats.err > 0 && (
                <button className="btn ghost" onClick={async () => {
                  setRunning(true);
                  await pool(leads.filter((l) => l.status === 'error'), (l) => runLead(l, runId), 2);
                  setRunning(false);
                }}>Retry failed</button>
              )}
              {leads.length > 0 && <button className="btn ghost" onClick={() => download(`${base}_intel.csv`, leadsToCsv(leads), 'text/csv')}>Export CSV</button>}
              {segment.result && <button className="btn ghost" onClick={() => download(`${base}_segment.md`, segmentToMarkdown(segment.result, fileName), 'text/markdown')}>Export strategy</button>}
              <button className="btn ghost" onClick={() => download(`${base}_intel.json`, JSON.stringify({ segment: segment.result, leads }, null, 2), 'application/json')}>JSON</button>
              <button className="btn primary" onClick={reset}>New CSV</button>
            </div>
          </div>

          <div className="split">
            <aside className="panel sidebar">
              {segment.status !== 'idle' && (
                <button className={`lead-item seg ${selected === SEGMENT_ID ? 'active' : ''}`} onClick={() => setSelected(SEGMENT_ID)}>
                  <span className={`dot ${segment.status}`} />
                  <span className="lead-text"><strong>Whole list strategy</strong><span className="muted small">{rows.length} leads</span></span>
                </button>
              )}
              {leads.length > 0 && (
                <div className="side-tools">
                  <input placeholder="Search leads" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <button className={`btn ghost sm ${sortByFit ? 'on' : ''}`} onClick={() => setSortByFit(!sortByFit)}>Best fit</button>
                </div>
              )}
              <div className="lead-list">
                {visibleLeads.map((l) => (
                  <button key={l.index} className={`lead-item ${selected === l.index ? 'active' : ''}`} onClick={() => setSelected(l.index)}>
                    <span className={`dot ${l.status}`} />
                    <span className="lead-text">
                      <strong>{l.result?.lead?.name || l.display.name}</strong>
                      <span className="muted small">{[l.display.role, l.display.company].filter(Boolean).join(' · ')}</span>
                    </span>
                    {l.result?.lead?.fit_score != null && <span className={`mini-fit ${fitTone(l.result.lead.fit_score)}`}>{l.result.lead.fit_score}</span>}
                  </button>
                ))}
              </div>
            </aside>

            <section className="detail-wrap">
              {selected === SEGMENT_ID && segment.status !== 'idle' && (
                <SegmentReport segment={segment} onRetry={() => runSegment(runId)} onPickLead={pickPriority} />
              )}
              {selectedLead && <LeadDetail key={selectedLead.index} lead={selectedLead} onRetry={() => runLead(selectedLead, runId)} />}
            </section>
          </div>
        </main>
      )}

      {showSettings && <Settings offer={offer} onClose={() => setShowSettings(false)} onSave={setOffer} />}
    </div>
  );
}
