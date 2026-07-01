/**
 * bl-load-data.js
 * ---------------
 * Handles fetching, parsing, and storing the book list data files.
 * Loads titles.txt and authors.txt from GitHub raw content URLs,
 * parses each record into structured objects, and stores them
 * in the global `bookData` object for use by other modules.
 *
 * Exports (globals):
 *   bookData        — object with .titles and .authors arrays (parsed objects),
 *                     .authorById lookup map, .loadedAt Date, null until loaded
 *   loadData()      — async function: fetches both files, parses records,
 *                     builds authorById lookup map, updates bookData,
 *                     sets status display, enables buttons
 *
 * Titles record layout (70 chars):
 *   0-39   title         40 chars
 *   40-43  pubYear        4 chars  (0000 if unknown)
 *   44-49  dateRead       6 chars  (YYMMdd, 2-digit year)
 *   50-53  authorId1      4 chars
 *   54-57  authorId2      4 chars
 *   58-61  authorId3      4 chars
 *   62-63  subject1       2 chars
 *   64-65  subject2       2 chars
 *   66-67  subject3       2 chars
 *
 * Authors record layout (38 chars):
 *   0-11   firstName     12 chars
 *   12-21  middleName    10 chars
 *   22-33  lastName      12 chars
 *   34-37  id             4 chars
 *
 * Author:  Claude (Anthropic) — claude.ai
 * Version: 1.0 — Initial separation from Git-Booklist.html (v2)
 * Version: 1.1 — Fix blank record at end of file caused by DOS \r\n line endings
 *                from dBase II output; trim each line before filtering.
 * Version: 1.2 — Strip Ctrl-Z (ASCII 26, \x1a) DOS end-of-file marker before
 *                splitting, as it survives the dBase II /A copy and causes a
 *                phantom blank record at the end of each file.
 * Version: 1.3 — Call updateElapsed() after successful load to update the
 *                data age display in the Data Loading section.
 * Version: 1.4 — Parse raw lines into structured objects at load time.
 *                Expand 2-digit years in dateRead to 4 digits (00-29 => 2000-2029,
 *                30-99 => 1930-1999); store as JavaScript Date, null if missing.
 *                elapsedDays() moved to main HTML file; data age display now
 *                refreshed via setInterval rather than only at load time.
 * Version: 1.5 — Build authorById lookup map after loading authors, for
 *                efficient author search in bl-search.js v2.0.
 * Version: 1.6 — Status message now shows both date and time of load, not
 *                time only. setButtonsEnabled() removed (duplicate of version
 *                in Git-Booklist.html which also covers search-btn); loadData()
 *                now calls the main HTML version directly.
 * Created:  2026-05-20
 * Modified: 2026-07-01
 */

const URLS = {
  titles:  'https://raw.githubusercontent.com/shanen5/bl/master/titles.txt',
  authors: 'https://raw.githubusercontent.com/shanen5/bl/master/authors.txt'
};

const bookData = {
  titles:     null,   // array of parsed title objects
  authors:    null,   // array of parsed author objects
  authorById: null,   // map from author id -> author object for fast lookup
  loadedAt:   null    // Date when last loaded
};

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

// Expand a 2-digit year string to a 4-digit integer
// Cutoff: 00-29 => 2000-2029, 30-99 => 1930-1999
function expandYear(yy) {
  const n = parseInt(yy, 10);
  if (isNaN(n)) return null;
  return n <= 29 ? 2000 + n : 1900 + n;
}

// Parse a 6-char dateRead field (YYMMdd) into a Date, or null if missing/zero
function parseDateRead(raw) {
  if (!raw || raw.trim() === '' || raw.trim() === '0') return null;
  const yy = raw.substring(0, 2);
  const mm = raw.substring(2, 4);
  const dd = raw.substring(4, 6);
  const year = expandYear(yy);
  const month = parseInt(mm, 10);
  const day   = parseInt(dd, 10);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);  // month is 0-based in JS Date
}

// Parse one raw titles line into a structured object
function parseTitleRecord(line) {
  return {
    title:     line.substring(0,  40).trimEnd(),
    pubYear:   parseInt(line.substring(40, 44), 10) || null,
    dateRead:  parseDateRead(line.substring(44, 50)),
    authorId1: parseInt(line.substring(50, 54), 10) || null,
    authorId2: parseInt(line.substring(54, 58), 10) || null,
    authorId3: parseInt(line.substring(58, 62), 10) || null,
    subject1:  line.substring(62, 64).trim(),
    subject2:  line.substring(64, 66).trim(),
    subject3:  line.substring(66, 68).trim()
  };
}

// Parse one raw authors line into a structured object
function parseAuthorRecord(line) {
  return {
    firstName:  line.substring(0,  12).trimEnd(),
    middleName: line.substring(12, 22).trimEnd(),
    lastName:   line.substring(22, 34).trimEnd(),
    id:         parseInt(line.substring(34, 38), 10)
  };
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

    const rawTitles  = titlesText.replace(/\x1a/g, '').split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '');
    const rawAuthors = authorsText.replace(/\x1a/g, '').split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '');

    bookData.titles   = rawTitles.map(parseTitleRecord);
    bookData.authors  = rawAuthors.map(parseAuthorRecord);
    bookData.loadedAt = new Date();

    // Build author lookup map for fast ID -> record access
    bookData.authorById = {};
    bookData.authors.forEach(a => { bookData.authorById[a.id] = a; });

    setStatus(
      `Loaded ${bookData.loadedAt.toLocaleDateString()} ${bookData.loadedAt.toLocaleTimeString()} — ` +
      `titles: ${bookData.titles.length} records, ` +
      `authors: ${bookData.authors.length} records`
    );
    setButtonsEnabled(true);
    if (typeof updateElapsed === 'function') updateElapsed();

  } catch (err) {
    setStatus(`Error loading data: ${err.message}`);
    console.error(err);
  }
}