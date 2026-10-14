export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text, filename, mimeType = 'text/plain') {
  const blob = new Blob([text], { type: mimeType });
  downloadBlob(blob, filename);
}

export function downloadJson(data, filename) {
  downloadText(JSON.stringify(data, null, 2), filename, 'application/json');
}

export function downloadCsv(rows, filename, { headers } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const csvHeaders = headers ?? Object.keys(rows[0]);
  const escapeCell = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    // Prevent spreadsheet formula injection by prefixing dangerous leading characters.
    const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    if (safe.includes('"') || safe.includes(',') || safe.includes('\n')) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };

  const lines = [
    csvHeaders.map(escapeCell).join(','),
    ...rows.map((row) => csvHeaders.map((key) => escapeCell(row[key])).join(',')),
  ];

  downloadText(lines.join('\n'), filename, 'text/csv');
}