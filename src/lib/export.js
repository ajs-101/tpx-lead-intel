import { toCsv } from './csv';

const join = (arr, fn = (x) => x) => (Array.isArray(arr) ? arr.map(fn).filter(Boolean).join('\n') : '');

export function download(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function leadsToCsv(leads) {
  const records = leads.map((l) => {
    const r = l.result || {};
    const o = r.outreach || {};
    return {
      ...l.row,
      intel_status: l.status,
      intel_error: l.error || '',
      fit_score: r.lead?.fit_score ?? '',
      fit_reason: r.lead?.fit_reason ?? '',
      pain_points: join(r.pain_points, (p) => `[${p.severity}] ${p.pain}`),
      psychology_triggers: join(r.psychology, (p) => `${p.trigger}: ${p.how_to_use}`),
      positioning_angle: r.positioning?.angle ?? '',
      positioning_one_liner: r.positioning?.one_liner ?? '',
      email_subject: o.email?.subject ?? '',
      email_body: o.email?.body ?? '',
      linkedin_connect: o.linkedin_connect ?? '',
      linkedin_dm: o.linkedin_dm ?? '',
      follow_up_subject: o.follow_up?.subject ?? '',
      follow_up_body: o.follow_up?.body ?? '',
      hooks: join(r.hooks),
      ctas: join(r.ctas),
    };
  });
  return toCsv(records);
}

export function segmentToMarkdown(s, fileName = 'leads') {
  if (!s) return '';
  const L = [];
  L.push(`# Segment Intel: ${fileName}`, '', s.overview?.summary || '', '');
  if (s.overview?.industries?.length) L.push(`**Industries:** ${s.overview.industries.join(', ')}`);
  if (s.overview?.roles?.length) L.push(`**Roles:** ${s.overview.roles.join(', ')}`, '');
  L.push('## Pain Points');
  (s.top_pain_points || []).forEach((p) => L.push(`- **${p.pain}** (${p.prevalence}): ${p.why}`));
  L.push('', '## Dark Psychology Playbook');
  (s.psychology_playbook || []).forEach((p) => L.push(`- **${p.trigger}**: ${p.when_to_use}`, `  > ${p.example_line}`));
  L.push('', '## Positioning', `**Core angle:** ${s.positioning?.core_angle || ''}`, '', `**Elevator pitch:** ${s.positioning?.elevator_pitch || ''}`, '');
  (s.positioning?.by_subsegment || []).forEach((p) => L.push(`- **${p.segment}**: ${p.angle}`));
  L.push('', '## Outreach Templates');
  (s.outreach_templates || []).forEach((t) => L.push(`### ${t.name} (${t.channel})`, t.subject ? `**Subject:** ${t.subject}` : '', '', t.body, ''));
  L.push('## Hooks');
  (s.hooks || []).forEach((h) => L.push(`- ${h}`));
  L.push('', '## CTAs');
  (s.ctas || []).forEach((c) => L.push(`- ${c}`));
  L.push('', '## Priority Leads');
  (s.priority_leads || []).forEach((p) => L.push(`- **${p.name}** (${p.company}): ${p.reason}`));
  return L.join('\n');
}
