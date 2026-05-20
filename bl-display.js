/**
 * bl-display.js
 * -------------
 * Handles rendering search results into the #results div.
 * Reads from the global `bookData` object populated by bl-load-data.js.
 *
 * Exports (globals):
 *   showLines(file, position) — renders first or last 5 lines of the
 *                               specified file ('titles' or 'authors')
 *                               into the #results div, replacing any
 *                               previous output.
 *   escapeHtml(str)           — utility: escapes HTML special characters
 *
 * Author:  Claude (Anthropic) — claude.ai
 * Version: 1.0 — Initial separation from Git-Booklist.html (v2)
 * Created: 2026-05-20
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showLines(file, position) {
  const lines = bookData[file];
  if (!lines) return;

  const slice = position === 'first' ? lines.slice(0, 5) : lines.slice(-5);
  const label = `${file.charAt(0).toUpperCase() + file.slice(1)} — ${position} 5 lines`;

  document.getElementById('results').innerHTML = `
    <div class="result-block">
      <h2>${label}</h2>
      <pre>${escapeHtml(slice.join('\n'))}</pre>
    </div>
  `;
}