/**
 * bl-load-data.js
 * ---------------
 * Handles fetching and storing the book list data files.
 * Loads titles.txt and authors.txt from GitHub raw content URLs,
 * splits them into arrays of non-empty lines, and stores them
 * in the global `bookData` object for use by other modules.
 *
 * Exports (globals):
 *   bookData        — object with .titles and .authors arrays, null until loaded
 *   loadData()      — async function: fetches both files, updates bookData,
 *                     sets status display, enables/disables buttons
 *
 * Author:  Claude (Anthropic) — claude.ai
 * Version: 1.0 — Initial separation from Git-Booklist.html (v2)
 * Created: 2026-05-20
 */

const URLS = {
  titles:  'https://raw.githubusercontent.com/shanen5/bl/master/titles.txt',
  authors: 'https://raw.githubusercontent.com/shanen5/bl/master/authors.txt'
};

const bookData = {
  titles:  null,
  authors: null,
  loadedAt: null
};

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

function setButtonsEnabled(enabled) {
  ['titles-first', 'titles-last', 'authors-first', 'authors-last', 'reload-btn']
    .forEach(id => document.getElementById(id).disabled = !enabled);
}

function elapsedDays(date) {
  const ms = Date.now() - date.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  return days < 1
    ? `${(days * 24).toFixed(1)} hours ago`
    : `${days.toFixed(1)} days ago`;
}

async function loadData() {
  setButtonsEnabled(false);
  setStatus('Loading data files…');

  try {
    const [titlesRes, authorsRes] = await Promise.all([
      fetch(URLS.titles),
      fetch(URLS.authors)
    ]);

    if (!titlesRes.ok)  throw new Error(`titles.txt: HTTP ${titlesRes.status}`);
    if (!authorsRes.ok) throw new Error(`authors.txt: HTTP ${authorsRes.status}`);

    const titlesText  = await titlesRes.text();
    const authorsText = await authorsRes.text();

    bookData.titles   = titlesText.split('\n').filter(l => l.trim() !== '');
    bookData.authors  = authorsText.split('\n').filter(l => l.trim() !== '');
    bookData.loadedAt = new Date();

    setStatus(
      `Loaded ${bookData.loadedAt.toLocaleTimeString()} — ` +
      `titles: ${bookData.titles.length} lines, ` +
      `authors: ${bookData.authors.length} lines`
    );
    setButtonsEnabled(true);

  } catch (err) {
    setStatus(`Error loading data: ${err.message}`);
    console.error(err);
  }
}