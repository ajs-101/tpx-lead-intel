# TPX Lead Intel Agent

Standalone agent for Trustpoint Xposure. Upload a leads CSV and it produces, for the whole list and for each lead:

1. **Pain points** (with evidence + severity)
2. **Dark psychology** (persuasion triggers that fit the lead, how to use them, example lines)
3. **Positioning** (strongest angle, one liner, value props, objection reframes)
4. **Outreach samples** (cold email, LinkedIn connect note, LinkedIn DM, follow up)
5. **Hooks & CTAs**

Stack: React (Vite) + Netlify Edge Function (Claude API proxy, key stays server side) + Firebase Firestore (run history, optional).
It does not touch any other app or agent.

## Run locally (Windows / PowerShell)

```powershell
npm install
npm install -g netlify-cli
copy .env.example .env      # then fill ANTHROPIC_API_KEY (+ Firebase vars if you want history)
netlify dev                 # opens http://localhost:8888
```

`npm run dev:ui` runs only the frontend (no Claude calls).

## Deploy to Netlify

1. Push this folder to a new GitHub repo, then **Add new site > Import** in Netlify. Build settings come from `netlify.toml`.
2. Site settings > Environment variables:
   - `ANTHROPIC_API_KEY` (required)
   - `CLAUDE_MODEL` (optional, default `claude-haiku-4-5-20251001`)
   - `APP_PASSCODE` (optional, recommended: blocks strangers from burning your API credits; team enters it in Settings)
   - `VITE_FIREBASE_*` (optional, for history)
3. Deploy.

## Firebase (history)

1. Create a Firebase project > Firestore Database > create.
2. Project settings > Your apps > Web app > copy the config into the `VITE_FIREBASE_*` vars.
3. Firestore rules. Simple version for an internal tool (tighten with Firebase Auth later):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /leadIntelRuns/{run=**} {
      allow read, write: if true;
    }
  }
}
```

Data layout: `leadIntelRuns/{runId}` (file, columns, offer, counts, segment strategy) and `leadIntelRuns/{runId}/leads/{index}` (row + result).

## How it works

- CSV is parsed in the browser (PapaParse). Any columns work; the full row goes to Claude.
- Per lead: one Claude call per lead, 3 in parallel by default, with retry/backoff and JSON repair. Failed leads can be retried.
- Whole list: one call over up to 120 leads, returns segment pain points, psychology playbook, sub segment positioning, merge tag templates, hooks, CTAs and top 5 priority leads.
- **Settings > What TPX sells** controls positioning. Add real proof points and case results there. The agent is told never to invent stats, clients or scarcity; missing proof comes back as `[placeholder]`.
- Exports: enriched CSV (original columns + all intel columns, ready for your sender), segment strategy as Markdown, full JSON.

## Files

```
netlify/edge-functions/analyze.js   Claude proxy + prompts + JSON schemas
src/App.jsx                         upload > configure > run > results flow
src/components/LeadDetail.jsx       per lead tabs
src/components/SegmentReport.jsx    whole list tabs
src/components/Settings.jsx         offer text + passcode
src/components/History.jsx          past runs (Firestore)
src/lib/                            csv, api (pool/retry), firebase, export
```
"# tpx-lead-intel" 
