/**
 * bl-search.js
 * ------------
 * Handles parsing, searching, and sorting of book data.
 * Reads from the global `bookData` object populated by bl-load-data.js.
 * Returns filtered and sorted arrays of records for rendering by bl-display.js.
 *
 * Supported query syntax (when regex enabled):
 *   .          any single character
 *   *          zero or more of preceding character
 *   .*         any sequence of characters
 *   |          OR between two patterns
 *   ^          start of field
 *   $          end of field
 *   ()         grouping
 *   []         character class, - for ranges e.g. [a-z]
 *   \          escape next character (e.g. \. for literal dot)
 *   ..         date range e.g. 1971..1981 (YYYY), 202601..202603 (YYYYMM),
 *              or 20260101..20260315 (YYYYMMDD) — always active regardless
 *              of regex setting
 *
 * Exports (globals):
 *   searchRecords(query, field, useRegex) — parses query, searches bookData.titles
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
 * Version: 1.1 — Updated to accept single field string (radio button selection).
 * Version: 1.2 — Subjects search changed to case-sensitive. Added sortRecords().
 * Version: 2.0 — Author search implemented. Author sort enabled.
 * Version: 2.1 — Fix date range search for 4-digit year-only inputs (e.g.
 *                1971..1981). parseDateBound accepts YYYY, YYYYMM, or YYYYMMDD.
 * Version: 2.2 — Regex now opt-in via useRegex parameter. When false, query is
 *                treated as a plain literal string (all special characters escaped
 *                automatically). Date range syntax (..) always active regardless
 *                of regex setting.
 * Created:  2026-05-24
 * Modified: 2026-07-02
 */

// Parse a date string in YYYY, YYYYMM, or YYYYMMDD format to a comparable integer
// isHigh: if true, pad to end of period; if false, pad to start of period
function parseDateBound(s, isHigh) {
  s = s.trim();
  if (s.length === 4) return parseInt(s + (isHigh ? '1231' : '0101'), 10);
  if (s.length === 6) return parseInt(s + (isHigh ? '31'   : '01'),   10);
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
  const match = query.match(/^(\d{4,8})\.\.(\d{4,8})$/);
  if (!match) return null;
  const low  = parseDateBound(match[1], false);
  const high = parseDateBound(match[2], true);
  if (!low || !high) return null;
  return { low, high };
}

// Escape all regex special characters for literal string search
function escapeLiteral(query) {
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Sanitize query for regex use: escape characters not in the allowed subset
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

// Build a RegExp from the query, respecting useRegex flag
function buildRegex(query, flags, useRegex) {
  const pattern = useRegex ? sanitizeQuery(query) : escapeLiteral(query);
  return new RegExp(pattern, flags);
}

// Search bookData.titles against a single field using query string
// field:    one of 'title', 'pubYear', 'dateRead', 'subjects', 'author'
// useRegex: if true, query is treated as regex; if false, plain literal
// Returns array of matching title record objects
function searchRecords(query, field, useRegex) {
  if (!bookData.titles || !query.trim()) return [];

  // Date range search applies only to dateRead field, always active
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

  // Author search
  if (field === 'author') {
    if (!bookData.authorById) return [];
    let regex;
    try {
      regex = buildRegex(query, 'i', useRegex);
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
    const flags = field === 'subjects' ? '' : 'i';
    regex = buildRegex(query, flags, useRegex);
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