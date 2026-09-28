import { useState } from 'react';
import { getPasscode, setPasscode } from '../lib/api';

export const DEFAULT_OFFER = `Trustpoint Xposure (TPX) is an AEO PR agency. We get brands featured and cited in credible third party publications and media, so AI answer engines (ChatGPT, Google AI Overviews, Perplexity, Gemini) mention and recommend them when buyers ask for options in their category. Outcomes: the brand shows up in AI answers instead of competitors, stronger authority and trust signals, earned media credibility that compounds.`;

const OFFER_KEY = 'tpx_lead_intel_offer';
export const loadOffer = () => {
  try { return localStorage.getItem(OFFER_KEY) || DEFAULT_OFFER; } catch { return DEFAULT_OFFER; }
};
const saveOffer = (v) => { try { localStorage.setItem(OFFER_KEY, v); } catch {} };

export default function Settings({ offer, onClose, onSave }) {
  const [text, setText] = useState(offer);
  const [pass, setPass] = useState(getPasscode());

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h2>Agent settings</h2>
        <label className="field">
          <span>What TPX sells (the agent positions around this)</span>
          <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
          <small className="muted">Add real proof points, packages, pricing ranges or case results here. The agent never invents proof, so anything missing shows up as a [placeholder].</small>
        </label>
        <button className="btn ghost sm" onClick={() => setText(DEFAULT_OFFER)}>Reset to default</button>
        <label className="field">
          <span>Team passcode (only if APP_PASSCODE is set on Netlify)</span>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>
        <div className="row end">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={() => { saveOffer(text); setPasscode(pass); onSave(text); onClose(); }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
