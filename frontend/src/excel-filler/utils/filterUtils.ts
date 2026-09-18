import { SkipRule } from '../types';

/**
 * Evaluates whether a single row matches a specific skip rule
 */
export function evaluateSkipRule(row: Record<string, any>, rule: SkipRule): boolean {
  if (!rule.column) return false;
  const rawCell = row[rule.column];
  const cellVal = rawCell !== undefined && rawCell !== null ? String(rawCell).trim().toLowerCase() : '';
  const targetVal = (rule.value || '').trim().toLowerCase();

  switch (rule.operator) {
    case 'equals':
      return cellVal === targetVal;
    case 'not_equals':
      return cellVal !== targetVal;
    case 'contains':
      return targetVal !== '' && cellVal.includes(targetVal);
    case 'not_contains':
      return targetVal !== '' && !cellVal.includes(targetVal);
    case 'starts_with':
      return targetVal !== '' && cellVal.startsWith(targetVal);
    case 'ends_with':
      return targetVal !== '' && cellVal.endsWith(targetVal);
    case 'is_empty':
      return cellVal === '';
    case 'is_not_empty':
      return cellVal !== '';
    default:
      return false;
  }
}

/**
 * Checks if a row should be skipped based on a list of skip rules
 */
export function shouldSkipRow(row: Record<string, any>, rules: SkipRule[]): boolean {
  const activeRules = rules.filter(r => r.enabled !== false && r.column && r.column.trim() !== '');
  if (activeRules.length === 0) return false;
  // If ANY enabled rule matches, skip the row
  return activeRules.some(r => evaluateSkipRule(row, r));
}

/**
 * Returns filtered rows excluding any rows that match active skip rules
 */
export function filterRowsBySkipRules(rows: Record<string, any>[], rules: SkipRule[]): Record<string, any>[] {
  const activeRules = rules.filter(r => r.enabled !== false && r.column && r.column.trim() !== '');
  if (activeRules.length === 0) return rows;
  return rows.filter(row => !shouldSkipRow(row, activeRules));
}
