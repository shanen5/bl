/**
 * bl-display.js
 * -------------
 * Handles rendering of book records into the #results div.
 * Reads from the global `bookData` object populated by bl-load-data.js.
 * Respects display options returned by getDisplayOptions() in the main HTML.
 *
 * Exports (globals):
 *   showRecords(file, position) — renders first or last 5 records of the
 *                                 specified file ('titles' or 'authors')
 *                                 into the #results div, replacing any
 *                                 previous output. Respects display options
 *                                 checkboxes for titles file; authors file
 *                                 always shows all fields.
 *   escapeHtml(str)             — utility: escapes HTML special characters
 *
 * Author:  Claude (Anthropic) — claude.ai
 * Version: 1.0 — Initial separation from Git-Booklist.html (v2)
 * Version: 1.1 — Updated to work with parsed record objects from bl-load-data.js
 *                v1.4. Titles display respects Display Options checkboxes.
 *                Author IDs shown as raw numbers pending name lookup feature.
 *                Safety check: displays message if no fields selected.
 * Created:  2026-05-20
 * Modified: 2026-05-24
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

// Format a single title record according to display options
function formatTitleRecord(rec, opts) {
  const parts = [];
  if (opts.title)    parts.push(escapeHtml(rec.title));
  if (opts.pubYear)  parts.push(rec.pubYear ? escapeHtml(String(rec.pubYear)) : '----');
  if (opts.dateRead) parts.push(formatDate(rec.dateRead) || '----------');
  if (opts.authors) {
    const ids = [rec.authorId1, rec.authorId2, rec.authorId3]
      .filter(id => id)
      .join(', ');
    parts.push(ids || '-');
  }
  if (opts.subjects) {
    const subs = [rec.subject1, rec.subject2, rec.subject3]
      .filter(s => s)
      .join(' ');
    parts.push(escapeHtml(subs) || '-');
  }
  return parts.join('  |  ');
}

// Format a single author record (always show all fields)
function formatAuthorRecord(rec) {
  const first  = escapeHtml(rec.firstName  || '');
  const middle = escapeHtml(rec.middleName || '');
  const last   = escapeHtml(rec.lastName   || '');
  const id     = String(rec.id).padStart(4, '0');
  return `${id}  ${last}, ${first} ${middle}`.trimEnd();
}

function showRecords(file, position) {
  const records = bookData[file];
  if (!records) return;

  const slice = position === 'first' ? records.slice(0, 5) : records.slice(-5);
  const label = `${file.charAt(0).toUpperCase() + file.slice(1)} — ${position} 5 records`;

  let lines;
  if (file === 'titles') {
    const opts = (typeof getDisplayOptions === 'function')
      ? getDisplayOptions()
      : { title: true, pubYear: true, dateRead: true, authors: true, subjects: true };

    const anySelected = Object.values(opts).some(v => v);
    if (!anySelected) {
      document.getElementById('results').innerHTML = `
        <div class="result-block">
          <h3>${label}</h3>
          <p style="color:var(--text-dim);font-style:italic">No display fields selected.</p>
        </div>`;
      return;
    }
    lines = slice.map(rec => formatTitleRecord(rec, opts));
  } else {
    // Authors: always show all fields
    lines = slice.map(formatAuthorRecord);
  }

  document.getElementById('results').innerHTML = `
    <div class="result-block">
      <h3>${label}</h3>
      <pre>${lines.join('\n')}</pre>
    </div>
  `;
}