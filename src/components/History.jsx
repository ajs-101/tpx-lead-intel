import { useEffect, useState } from 'react';
import { listRuns, deleteRun, firebaseEnabled } from '../lib/firebase';

const fmt = (ts) => (ts?.toDate ? ts.toDate().toLocaleString() : '');

export default function History({ onOpen }) {
  const [runs, setRuns] = useState(null);
  const [err, setErr] = useState('');

  const refresh = () => listRuns().then(setRuns).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); }, []);

  if (!firebaseEnabled) {
    return (
      <div className="panel empty-state">
        <h2>History is off</h2>
        <p className="muted">Add the VITE_FIREBASE_* variables on Netlify to save every run to Firestore.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Past runs</h2>
      {err && <div className="alert">{err}</div>}
      {!runs && !err && <div className="empty"><div className="spinner" /> Loading…</div>}
      {runs?.length === 0 && <p className="muted">No runs yet.</p>}
      <div className="history">
        {runs?.map((r) => (
          <div className="history-row" key={r.id}>
            <button className="history-main" onClick={() => onOpen(r.id)}>
              <strong>{r.fileName}</strong>
              <span className="muted small">{fmt(r.createdAt)} · {r.done}/{r.total} leads · {r.status}</span>
            </button>
            <button
              className="btn ghost sm"
              onClick={async () => {
                if (!window.confirm(`Delete run "${r.fileName}"?`)) return;
                await deleteRun(r.id);
                refresh();
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
