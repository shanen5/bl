/**
 * bl-search.js
 * ------------
 * Handles parsing and execution of searches against the book data.
 * Reads from the global `bookData` object populated by bl-load-data.js.
 * Returns filtered arrays of records for rendering by bl-display.js.
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
 *   searchRecords(query, field) — parses query, searches bookData.titles
 *                                 against specified field string, returns
 *                                 matching records array. Returns [] if
 *                                 no match or error.
 *
 * Author:  Claude (Anthropic) — claude.ai
 * Version: 1.0 — Initial separation from Git-Booklist.html (v2.4).
 *                Supports regex subset and .. date range on title field.
 *                Author search stubbed out pending v2.0 implementation.
 * Version: 1.1 — Updated to accept single field string (radio button selection)
 *                rather than fields object (checkbox selection), matching
 *                Git-Booklist.html v2.5.
 * Created: 2026-05-24
 * Modified: 2026-05-28
 *
 * Planned:
 *   v2.0 — Author search (requires joining titles and authors datasets)
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

  // Author search — not yet implemented
  if (field === 'author') {
    console.warn('Author search not yet implemented');
    return [];
  }

  // Build regex from query
  let regex;
  try {
    const sanitized = sanitizeQuery(query);
    regex = new RegExp(sanitized, 'i');  // case-insensitive
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