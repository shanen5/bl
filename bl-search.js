/**
 * bl-search.js
 * ------------
 * Handles parsing, searching, and sorting of book data.
 * Reads from the global `bookData` object populated by bl-load-data.js.
 * Returns filtered and sorted arrays of records for rendering by bl-display.js.
 *
 * Supported query syntax:
 *   .          any single character
 *   *          zero or more of preceding character
 *   .*         any sequence of characters
 *   |          OR between two patterns
 *   ^          start of field
 *   $          end of field
 *   ()         grouping
 *   []         character class, - for ranges e.g. [a-z]
 *   \          escape next character (e.g. \. for literal dot)
 *   ..         date range e.g. 202601..20260315 (YYYYMM or YYYYMMDD)
 *
 * Exports (globals):
 *   searchRecords(query, field)      — parses query, searches bookData.titles
 *                                      against specified field string, returns
 *                                      matching records array. Returns [] if
 *                                      no match or error.
 *   sortRecords(records, field, dir) — sorts a records array by specified field
 *                                      and direction ('asc' or 'desc'). Title
 *                                      sort ignores leading articles (a/an/the).
 *                                      Author sort by last name, first name as
 *                                      tiebreaker. Returns sorted copy.
 *
 * Author:  Claude (Anthropic) — claude.ai
 * Version: 1.0 — Initial separation from Git-Booklist.html (v2.4).
 *                Supports regex subset and .. date range on title field.
 *                Author search stubbed out pending v2.0 implementation.
 * Version: 1.1 — Updated to accept single field string (radio button selection)
 *                rather than fields object (checkbox selection), matching
 *                Git-Booklist.html v2.5.
 * Version: 1.2 — Subjects search changed to case-sensitive. Added sortRecords()
 *                with single sort field, asc/desc direction, article stripping
 *                for title sort, localeCompare throughout.
 * Version: 2.0 — Author search implemented. Regex matched against concatenated
 *                firstName + middleName + lastName for each of up to three
 *                author IDs on a title record, using authorById lookup map from
 *                bl-load-data.js v1.5. Author sort enabled, sorting by lastName
 *                then firstName as tiebreaker. Author search is case-insensitive.
 * Created:  2026-05-24
 * Modified: 2026-05-30
 */

// Parse a date string in YYYYMM or YYYYMMDD format to a comparable integer
function parseDateBound(s) {
  s = s.trim();
  if (s.length === 6) return parseInt(s + '00', 10);
  if (s.length === 8) return parseInt(s, 10);
  return null;
}

// Convert a dateRead Date to YYYYMMDD integer for range comparison
function dateToInt(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return parseInt(`${y}${m}${day}`, 10);
}

// Detect and parse a .. date range query, returns {low, high} or null
function parseDateRange(query) {
  const match = query.match(/^(\d{6,8})\.\.(\d{6,8})$/);
  if (!match) return null;
  const low  = parseDateBound(match[1]);
  const high = parseDateBound(match[2]);
  if (!low || !high) return null;
  const highAdj = String(match[2]).length === 6
    ? parseInt(match[2] + '99', 10)
    : high;
  return { low, high: highAdj };
}

// Sanitize query: escape characters not in the allowed regex subset
function sanitizeQuery(query) {
  return query.replace(/[^a-zA-Z0-9.*|^$()[\]\\{}\-_' ]/g, c => '\\' + c);
}

// Strip leading article for title sort key
function titleSortKey(title) {
  return (title || '').replace(/^(a |an |the )/i, '').trim();
}

// Build a searchable name string from an author record
function authorSearchString(author) {
  if (!author) return '';
  return [author.firstName, author.middleName, author.lastName]
    .filter(Boolean)
    .join(' ');
}

// Get author sort key: lastName then firstName as tiebreaker
function authorSortKey(rec) {
  const ids = [rec.authorId1, rec.authorId2, rec.authorId3].filter(Boolean);
  if (!ids.length || !bookData.authorById) return '';
  const a = bookData.authorById[ids[0]];
  if (!a) return '';
  return `${a.lastName || ''} ${a.firstName || ''}`.trim();
}

// Search bookData.titles against a single field using query string
// field: one of 'title', 'pubYear', 'dateRead', 'subjects', 'author'
// Returns array of matching title record objects
function searchRecords(query, field) {
  if (!bookData.titles || !query.trim()) return [];

  // Date range search applies only to dateRead field
  if (field === 'dateRead') {
    const dateRange = parseDateRange(query.trim());
    if (dateRange) {
      return bookData.titles.filter(rec => {
        const d = dateToInt(rec.dateRead);
        if (!d) return false;
        return d >= dateRange.low && d <= dateRange.high;
      });
    }
  }

  // Author search — regex matched against all name fields of each linked author
  if (field === 'author') {
    if (!bookData.authorById) return [];
    let regex;
    try {
      const sanitized = sanitizeQuery(query);
      regex = new RegExp(sanitized, 'i');  // author search is case-insensitive
    } catch (e) {
      console.error('Invalid search pattern:', e);
      return [];
    }
    return bookData.titles.filter(rec => {
      const ids = [rec.authorId1, rec.authorId2, rec.authorId3].filter(Boolean);
      return ids.some(id => {
        const author = bookData.authorById[id];
        return author && regex.test(authorSearchString(author));
      });
    });
  }

  // Build regex — subjects are case-sensitive, all others case-insensitive
  let regex;
  try {
    const sanitized = sanitizeQuery(query);
    const flags = field === 'subjects' ? '' : 'i';
    regex = new RegExp(sanitized, flags);
  } catch (e) {
    console.error('Invalid search pattern:', e);
    return [];
  }

  // Search the selected field
  return bookData.titles.filter(rec => {
    switch (field) {
      case 'title':
        return regex.test(rec.title);
      case 'pubYear':
        return regex.test(String(rec.pubYear || ''));
      case 'dateRead':
        return regex.test(dateToInt(rec.dateRead) ? String(dateToInt(rec.dateRead)) : '');
      case 'subjects':
        return regex.test(
          [rec.subject1, rec.subject2, rec.subject3].filter(Boolean).join(' ')
        );
      default:
        return false;
    }
  });
}

// Sort a records array by field and direction
// field: one of 'none', 'title', 'pubYear', 'dateRead', 'subjects', 'author'
// dir:   'asc' or 'desc'
// Returns a sorted copy — original array is not modified
function sortRecords(records, field, dir) {
  if (!records || field === 'none') return records;

  const asc = dir !== 'desc';
  const sorted = [...records];

  sorted.sort((a, b) => {
    let valA, valB;

    switch (field) {
      case 'title':
        valA = titleSortKey(a.title);
        valB = titleSortKey(b.title);
        return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);

      case 'pubYear':
        valA = a.pubYear || 0;
        valB = b.pubYear || 0;
        return asc ? valA - valB : valB - valA;

      case 'dateRead':
        valA = dateToInt(a.dateRead) || 0;
        valB = dateToInt(b.dateRead) || 0;
        return asc ? valA - valB : valB - valA;

      case 'subjects':
        valA = [a.subject1, a.subject2, a.subject3].filter(Boolean).join(' ');
        valB = [b.subject1, b.subject2, b.subject3].filter(Boolean).join(' ');
        return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);

      case 'author':
        valA = authorSortKey(a);
        valB = authorSortKey(b);
        return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);

      default:
        return 0;
    }
  });

  return sorted;
}