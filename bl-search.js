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
 *   searchRecords(query, fields) — parses query, searches bookData.titles
 *                                  against specified fields, returns matching
 *                                  records array. Date range applies to
 *                                  dateRead field. Returns [] if no match.
 *
 * Author:  Claude (Anthropic) — claude.ai
 * Version: 1.0 — Initial separation from Git-Booklist.html (v2.4).
 *                Supports regex subset and .. date range on title field.
 *                Author search stubbed out pending v2.0 implementation.
 * Created: 2026-05-24
 *
 * Planned:
 *   v2.0 — Author search (requires joining titles and authors datasets)
 */

// Allowed regex special characters — anything else is escaped
const ALLOWED_SPECIAL = /[.*|^$()[\]\\]/g;

// Parse a date string in YYYYMM or YYYYMMDD format to a comparable integer
function parseDateBound(s) {
  s = s.trim();
  if (s.length === 6) return parseInt(s + '00', 10);  // YYYYMM -> YYYYMM00
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
  // Expand YYYYMM00 high bound to end of month (treat as YYYYMM99)
  const highAdj = String(match[2]).length === 6
    ? parseInt(match[2] + '99', 10)
    : high;
  return { low, high: highAdj };
}

// Sanitize query: strip characters not in allowed set
function sanitizeQuery(query) {
  // Allow only safe regex subset — remove anything unexpected
  // We trust the allowed set defined above; other chars are escaped
  return query.replace(/[^a-zA-Z0-9.*|^$()[\]\\{}\-_' ]/g, c => '\\' + c);
}

// Search bookData.titles against specified fields using query string
// fields: object with boolean keys matching title record fields
// Returns array of matching title record objects
function searchRecords(query, fields) {
  if (!bookData.titles || !query.trim()) return [];

  // Check for date range query on dateRead field
  const dateRange = fields.dateRead ? parseDateRange(query.trim()) : null;
  if (dateRange) {
    return bookData.titles.filter(rec => {
      const d = dateToInt(rec.dateRead);
      if (!d) return false;
      return d >= dateRange.low && d <= dateRange.high;
    });
  }

  // Author search — stub, not yet implemented
  if (fields.author) {
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

  // Search across selected fields
  return bookData.titles.filter(rec => {
    if (fields.title    && regex.test(rec.title))               return true;
    if (fields.pubYear  && regex.test(String(rec.pubYear || ''))) return true;
    if (fields.subjects && regex.test(
      [rec.subject1, rec.subject2, rec.subject3].filter(Boolean).join(' ')
    )) return true;
    return false;
  });
}