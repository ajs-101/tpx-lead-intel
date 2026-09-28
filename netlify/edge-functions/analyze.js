// TPX Lead Intel Agent: Claude proxy (Netlify Edge Function).
// Edge functions only count CPU time, not time spent waiting on Anthropic,
// so long generations don't hit the 10s limit of regular Netlify Functions.

export const config = { path: '/api/analyze' };

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const env = (k) => {
  try {
    if (typeof Netlify !== 'undefined') return Netlify.env.get(k);
  } catch (_) {}
  try {
    if (typeof Deno !== 'undefined') return Deno.env.get(k);
  } catch (_) {}
  return typeof process !== 'undefined' ? process.env[k] : undefined;
};

export const DEFAULT_OFFER = `Trustpoint Xposure (TPX) is an AEO PR agency. We get brands featured and cited in credible third party publications and media, so AI answer engines (ChatGPT, Google AI Overviews, Perplexity, Gemini) mention and recommend them when buyers ask for options in their category. Outcomes: the brand shows up in AI answers instead of competitors, stronger authority and trust signals, earned media credibility that compounds.`;

const WRITING_RULES = `Writing rules for every outreach message, hook and CTA:
- Sound like a real person typing, not AI. No buzzwords (leverage, unlock, elevate, game changer, synergy, delve, in today's landscape), no em dashes, no "I hope this finds you well".
- Greetings are plain: "Hey Sarah," or "Hi Sarah,". No hyphens or colons in greetings.
- Casual, confident, a little humor where it fits. Short paragraphs of 1 to 2 sentences.
- Reference something specific about the lead so it clearly isn't a template.
- End emails and DMs with an easy yes/no question.
- Cold email body under 110 words. LinkedIn connection note under 280 characters.`;

const ETHICS = `"Dark psychology" in this tool means real persuasion psychology (loss aversion, social proof, authority, FOMO, status, curiosity gaps, reciprocity, commitment and consistency, contrast, identity). Use it sharply but truthfully:
- Never invent statistics, client names, case studies, deadlines, scarcity or quotes. If you need proof, use a placeholder like [client result] so the sender fills in a real one.
- Only claim things the offer description supports.
- Frame triggers around real consequences the lead faces (e.g. competitors being named by ChatGPT instead of them), not threats or deception.`;

const LEAD_SCHEMA = `{
  "lead": { "name": "", "company": "", "role": "", "industry": "", "fit_score": 1, "fit_reason": "" },
  "pain_points": [ { "pain": "", "evidence": "what in the data suggests this", "severity": "high|medium|low" } ],
  "psychology": [ { "trigger": "e.g. Loss aversion", "why_it_works": "why this lead is susceptible", "how_to_use": "tactic", "example_line": "a line you could send" } ],
  "positioning": {
    "angle": "the single strongest angle for this lead",
    "one_liner": "how to describe TPX to this exact person in one sentence",
    "value_props": [""],
    "objections": [ { "objection": "", "reframe": "" } ]
  },
  "outreach": {
    "email": { "subject": "", "body": "" },
    "linkedin_connect": "",
    "linkedin_dm": "",
    "follow_up": { "subject": "", "body": "" }
  },
  "hooks": [""],
  "ctas": [""]
}`;

const SEGMENT_SCHEMA = `{
  "overview": { "summary": "who this list is in 2 to 3 sentences", "industries": [""], "roles": [""], "avg_fit": 1 },
  "top_pain_points": [ { "pain": "", "prevalence": "high|medium|low", "why": "" } ],
  "psychology_playbook": [ { "trigger": "", "when_to_use": "", "example_line": "" } ],
  "positioning": {
    "core_angle": "",
    "elevator_pitch": "",
    "by_subsegment": [ { "segment": "", "angle": "" } ]
  },
  "outreach_templates": [ { "name": "", "channel": "email|linkedin", "subject": "", "body": "use {{first_name}} and {{company}} merge tags" } ],
  "hooks": [""],
  "ctas": [""],
  "priority_leads": [ { "name": "", "company": "", "reason": "" } ]
}`;

function systemPrompt(offer) {
  return `You are the Lead Intel Agent for Trustpoint Xposure, a senior B2B sales strategist and copywriter who specialises in AEO (Answer Engine Optimization) and PR.

WHAT WE SELL:
${offer || DEFAULT_OFFER}

${ETHICS}

${WRITING_RULES}

Output ONLY valid JSON matching the schema you are given. No markdown fences, no commentary before or after.`;
}

function leadPrompt(row) {
  return `Analyze this single lead from a CSV and build a tailored outreach kit.

LEAD DATA (column: value):
${Object.entries(row)
  .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
  .map(([k, v]) => `${k}: ${String(v).slice(0, 600)}`)
  .join('\n')}

Requirements:
- pain_points: 3 to 5, specific to their industry, role and company stage. Tie them to AI visibility, brand authority and being found by buyers.
- psychology: 3 to 4 triggers that fit THIS person.
- positioning.value_props: 3. positioning.objections: 2 to 3 likely ones.
- hooks: 5 opening lines/subject lines. ctas: 4, from soft to direct.
- fit_score: 1 to 10 for how good a TPX client they'd be.
If a field is missing from the data, infer carefully from what is there and say so in evidence.

Return JSON in exactly this shape:
${LEAD_SCHEMA}`;
}

function segmentPrompt(rows, columns) {
  const compact = rows.slice(0, 120).map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') o[k] = String(v).slice(0, 160);
    }
    return o;
  });
  return `Analyze this whole lead list as a segment and build a campaign strategy for it.

COLUMNS: ${columns.join(', ')}
TOTAL LEADS: ${rows.length}${rows.length > 120 ? ' (first 120 shown)' : ''}

LEADS (JSON lines):
${compact.map((r) => JSON.stringify(r)).join('\n')}

Requirements:
- top_pain_points: 5, ranked by how common they are across the list.
- psychology_playbook: 5 triggers that work on this segment.
- positioning.by_subsegment: split the list into 2 to 4 natural subsegments.
- outreach_templates: 3 (cold email, LinkedIn DM, follow up) with merge tags.
- hooks: 8. ctas: 6.
- priority_leads: the 5 best fits from the list, with a reason.

Return JSON in exactly this shape:
${SEGMENT_SCHEMA}`;
}

export function extractJson(text) {
  if (!text) throw new Error('Empty response');
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch (_) {
    // light repair: trailing commas and smart quotes
    const repaired = t.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
    return JSON.parse(repaired);
  }
}

async function callClaude({ system, user, maxTokens }) {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) throw Object.assign(new Error('ANTHROPIC_API_KEY is not set on the server'), { status: 500 });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env('CLAUDE_MODEL') || DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`), {
      // 429/529 = busy (client backs off), 5xx = transient (retry here), 4xx = key/config problem (fail fast)
      status: res.status === 429 || res.status === 529 ? 429 : res.status >= 500 ? 502 : 500,
    });
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function generateJson({ system, user, maxTokens }) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const prompt =
      attempt === 0
        ? user
        : `${user}\n\nIMPORTANT: your previous reply was not valid JSON (${lastErr?.message}). Reply with the JSON object only, starting with { and ending with }.`;
    try {
      const text = await callClaude({ system, user: prompt, maxTokens });
      return extractJson(text);
    } catch (e) {
      lastErr = e;
      if (e.status && e.status !== 502) throw e; // auth / rate limit / config: don't burn retries
    }
  }
  throw lastErr;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const passcode = env('APP_PASSCODE');
  if (passcode && req.headers.get('x-app-passcode') !== passcode) {
    return json({ error: 'Wrong or missing passcode' }, 401);
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { mode, offer } = body || {};
  const system = systemPrompt(offer);

  try {
    if (mode === 'lead') {
      if (!body.row || typeof body.row !== 'object') return json({ error: 'row is required' }, 400);
      const result = await generateJson({ system, user: leadPrompt(body.row), maxTokens: 3000 });
      return json({ result });
    }
    if (mode === 'segment') {
      if (!Array.isArray(body.rows) || !body.rows.length) return json({ error: 'rows are required' }, 400);
      const columns = body.columns || Object.keys(body.rows[0]);
      const result = await generateJson({ system, user: segmentPrompt(body.rows, columns), maxTokens: 5000 });
      return json({ result });
    }
    if (mode === 'ping') return json({ ok: true, hasKey: !!env('ANTHROPIC_API_KEY'), passcode: !!passcode });
    return json({ error: 'mode must be lead, segment or ping' }, 400);
  } catch (e) {
    return json({ error: e.message || 'Unknown error' }, e.status || 500);
  }
}
