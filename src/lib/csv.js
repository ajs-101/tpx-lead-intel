import Papa from 'papaparse';

export function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const rows = res.data.filter((r) => Object.values(r).some((v) => String(v ?? '').trim()));
        const columns = (res.meta.fields || []).filter(Boolean);
        if (!rows.length) return reject(new Error('No rows found in this CSV'));
        resolve({ rows, columns });
      },
      error: reject,
    });
  });
}

const pick = (row, patterns) => {
  const keys = Object.keys(row);
  for (const p of patterns) {
    const k = keys.find((key) => p.test(key));
    if (k && String(row[k] ?? '').trim()) return String(row[k]).trim();
  }
  return '';
};

// Best-effort display fields; the full row always goes to Claude.
export function displayFields(row) {
  const first = pick(row, [/^first.?name$/i, /^first$/i]);
  const last = pick(row, [/^last.?name$/i, /^last$/i]);
  const full = pick(row, [/^(full.?)?name$/i, /contact.?name/i, /^person/i]);
  return {
    name: full || [first, last].filter(Boolean).join(' ') || 'Unknown lead',
    company: pick(row, [/^company/i, /organi[sz]ation/i, /business/i, /^account/i, /brand/i]),
    role: pick(row, [/title/i, /role/i, /position/i, /designation/i]),
    email: pick(row, [/e-?mail/i]),
  };
}

export function toCsv(records) {
  return Papa.unparse(records);
}
