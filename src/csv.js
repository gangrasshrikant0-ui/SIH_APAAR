function parseCsv(text) {
  const lines = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell); if (row.some((value) => value.trim())) lines.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); lines.push(row); }
  if (quoted) throw new Error('Malformed CSV: unterminated quoted field.');
  if (!lines.length || lines[0].some((header) => !header.trim())) throw new Error('CSV must contain non-empty headers.');
  const headers = lines.shift().map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase());
  if (headers.some((header) => !header)) throw new Error('CSV must contain non-empty headers.');
  return lines.map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()])));
}

function safeCsv(value) {
  const stringValue = String(value ?? '');
  return /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
}
function toCsv(rows, headers = Object.keys(rows[0] || {})) {
  return [headers.join(','), ...rows.map((row) => headers.map((header) => {
    const value = safeCsv(row[header]);
    return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  }).join(','))].join('\n');
}

module.exports = { parseCsv, toCsv };
