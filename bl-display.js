/**
 * bl-display.js
 * -------------
 * Handles rendering of book records into the #results div.
 * Receives pre-filtered record arrays from bl-search.js or
 * directly from bookData for diagnostic displays.
 * Respects display options and result format returned by
 * getDisplayOptions() and getResultFormat() in the main HTML.
 *
 * Exports (globals):
 *   showRecords(file, position) — diagnostic display of first or last 5
 *                                 records from specified file, used by
 *                                 Data Loading section buttons.
 *   displayResults(records, label) — renders an array of title record objects
 *                                 into #results, respecting Display Options
 *                                 and Result Format selection.
 *   escapeHtml(str)             — utility: escapes HTML special characters
 *   formatDate(d)               — utility: formats a Date as YYYY-MM-DD
 *
 * Result formats:
 *   dense  — pipe-separated fields on one line per record (default, phone-friendly)
 *   table  — HTML table with author names resolved from authorById
 *   csv    — comma-delimited, fields quoted if needed
 *   count  — total matching record count only
 *
 * Author:  Claude (Anthropic) — claude.ai
 * Version: 1.0 — Initial separation from Git-Booklist.html (v2)
 * Version: 1.1 — Updated to work with parsed record objects from bl-load-data.js
 *                v1.4. Titles display respects Display Options checkboxes.
 *                Author IDs shown as raw numbers pending name lookup feature.
 *                Safety check: displays message if no fields selected.
 * Version: 1.2 — Search logic moved to bl-search.js. Added displayResults()
 *                for rendering search results. showRecords() retained for
 *                diagnostic First 5 / Last 5 display in Data Loading section.
 * Version: 1.3 — Added result format support: Dense (existing), Table (HTML
 *                table with resolved author names), CSV (comma-delimited),
 *                Count (total only). Format selected via getResultFormat()
 *                in main HTML. Table format always resolves author names
 *                regardless of Authors display checkbox.
 * Version: 1.4 — Added Wide HTML (full borders) and Tight HTML (no borders)
 *                table formats. All three HTML table formats resolve author
 *                names. CSS class applied to table element controls styling.
 * Created:  2026-05-20
 * Modified: 2026-05-31
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Format a JavaScript Date as YYYY-MM-DD, or blank if null
function formatDate(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Resolve author IDs to a display name string
function resolveAuthors(rec, asNames) {
  const ids = [rec.authorId1, rec.authorId2, rec.authorId3].filter(Boolean);
  if (!ids.length) return '';
  if (!asNames || !bookData.authorById) return ids.join(', ');
  return ids.map(id => {
    const a = bookData.authorById[id];
    if (!a) return String(id);
    return [a.firstName, a.middleName, a.lastName].filter(Boolean).join(' ');
  }).join('; ');
}

// Format subjects as a space-separated string
function formatSubjects(rec) {
  return [rec.subject1, rec.subject2, rec.subject3].filter(Boolean).join(' ');
}

// Quote a CSV field if it contains comma, quote, or newline
function csvField(val) {
  const s = String(val === null || val === undefined ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ── Dense format ──────────────────────────────────────────────────────────────
function formatDense(records, opts) {
  const lines = records.map(rec => {
    const parts = [];
    if (opts.title)    parts.push(escapeHtml(rec.title));
    if (opts.pubYear)  parts.push(rec.pubYear ? String(rec.pubYear) : '----');
    if (opts.dateRead) parts.push(formatDate(rec.dateRead) || '----------');
    if (opts.authors)  parts.push(escapeHtml(resolveAuthors(rec, false)) || '-');
    if (opts.subjects) parts.push(escapeHtml(formatSubjects(rec)) || '-');
    return parts.join('  |  ');
  });
  return `<pre>${lines.join('\n')}</pre>`;
}

// ── Table format (shared by Table, Wide HTML, Tight HTML) ────────────────────
function formatTable(records, opts, tableClass) {
  const cols = [];
  if (opts.title)    cols.push({ key: 'title',    label: 'Title' });
  if (opts.pubYear)  cols.push({ key: 'pubYear',  label: 'Year' });
  if (opts.dateRead) cols.push({ key: 'dateRead', label: 'Date Read' });
  if (opts.authors)  cols.push({ key: 'authors',  label: 'Author(s)' });
  if (opts.subjects) cols.push({ key: 'subjects', label: 'Subjects' });

  const header = cols.map(c => `<th>${c.label}</th>`).join('');
  const rows = records.map(rec => {
    const cells = cols.map(c => {
      let val = '';
      switch (c.key) {
        case 'title':    val = escapeHtml(rec.title); break;
        case 'pubYear':  val = rec.pubYear ? String(rec.pubYear) : ''; break;
        case 'dateRead': val = formatDate(rec.dateRead); break;
        case 'authors':  val = escapeHtml(resolveAuthors(rec, true)); break;
        case 'subjects': val = escapeHtml(formatSubjects(rec)); break;
      }
      return `<td>${val}</td>`;
    });
    return `<tr>${cells.join('')}</tr>`;
  });

  const cls = tableClass ? `result-table ${tableClass}` : 'result-table';
  return `
    <div style="overflow-x:auto">
      <table class="${cls}">
        <thead><tr>${header}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

// ── CSV format ────────────────────────────────────────────────────────────────
function formatCSV(records, opts) {
  const cols = [];
  if (opts.title)    cols.push({ key: 'title',    label: 'Title' });
  if (opts.pubYear)  cols.push({ key: 'pubYear',  label: 'PubYear' });
  if (opts.dateRead) cols.push({ key: 'dateRead', label: 'DateRead' });
  if (opts.authors)  cols.push({ key: 'authors',  label: 'Authors' });
  if (opts.subjects) cols.push({ key: 'subjects', label: 'Subjects' });

  const header = cols.map(c => csvField(c.label)).join(',');
  const rows = records.map(rec => {
    return cols.map(c => {
      switch (c.key) {
        case 'title':    return csvField(rec.title);
        case 'pubYear':  return csvField(rec.pubYear || '');
        case 'dateRead': return csvField(formatDate(rec.dateRead));
        case 'authors':  return csvField(resolveAuthors(rec, false));
        case 'subjects': return csvField(formatSubjects(rec));
        default:         return '';
      }
    }).join(',');
  });

  return `<pre>${escapeHtml([header, ...rows].join('\n'))}</pre>`;
}

// ── Main displayResults ───────────────────────────────────────────────────────
function displayResults(records, label) {
  const opts = (typeof getDisplayOptions === 'function')
    ? getDisplayOptions()
    : { title: true, pubYear: true, dateRead: true, authors: true, subjects: true };

  const format = (typeof getResultFormat === 'function')
    ? getResultFormat()
    : 'dense';

  const count = records ? records.length : 0;
  const heading = label
    ? `${label} — ${count} record${count !== 1 ? 's' : ''}`
    : `${count} record${count !== 1 ? 's' : ''}`;

  // Count format — just show the number
  if (format === 'count') {
    document.getElementById('results').innerHTML = `
      <div class="result-block">
        <h3>${escapeHtml(heading)}</h3>
      </div>`;
    return;
  }

  const anySelected = Object.values(opts).some(v => v);
  if (!anySelected) {
    document.getElementById('results').innerHTML = `
      <div class="result-block">
        <h3>${escapeHtml(heading)}</h3>
        <p style="color:var(--text-dim);font-style:italic">No display fields selected.</p>
      </div>`;
    return;
  }

  if (!records || records.length === 0) {
    document.getElementById('results').innerHTML = `
      <div class="result-block">
        <h3>${escapeHtml(label || 'Results')}</h3>
        <p style="color:var(--text-dim);font-style:italic">No matching records found.</p>
      </div>`;
    return;
  }

  let body = '';
  switch (format) {
    case 'table': body = formatTable(records, opts, '');      break;
    case 'wide':  body = formatTable(records, opts, 'wide');  break;
    case 'tight': body = formatTable(records, opts, 'tight'); break;
    case 'csv':   body = formatCSV(records, opts);            break;
    default:      body = formatDense(records, opts);          break;
  }

  document.getElementById('results').innerHTML = `
    <div class="result-block">
      <h3>${escapeHtml(heading)}</h3>
      ${body}
    </div>`;
}

// Diagnostic: show first or last 5 records from either file
function showRecords(file, position) {
  const records = bookData[file];
  if (!records) return;

  const slice = position === 'first' ? records.slice(0, 5) : records.slice(-5);
  const label = `${file.charAt(0).toUpperCase() + file.slice(1)} — ${position} 5 records`;

  if (file === 'authors') {
    const lines = slice.map(rec => {
      const first  = escapeHtml(rec.firstName  || '');
      const middle = escapeHtml(rec.middleName || '');
      const last   = escapeHtml(rec.lastName   || '');
      const id     = String(rec.id).padStart(4, '0');
      return `${id}  ${last}, ${first} ${middle}`.trimEnd();
    });
    document.getElementById('results').innerHTML = `
      <div class="result-block">
        <h3>${label}</h3>
        <pre>${lines.join('\n')}</pre>
      </div>`;
  } else {
    displayResults(slice, label);
  }
}