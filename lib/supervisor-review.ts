import type { ShiftStatus } from '@/lib/shift-open'
export type { ShiftStatus }

export type ValidationResult = { valid: true } | { valid: false; error: string }

/**
 * Guards the flag/unflag action.
 * Only closed shifts may be flagged or unflagged.
 */
export function canFlag(status: ShiftStatus): boolean {
  return status === 'closed'
}

/**
 * Guards the post-close correction (override) action.
 * Only closed shifts may have readings overridden.
 */
export function canOverride(status: ShiftStatus): boolean {
  return status === 'closed'
}

/**
 * Validates the comment required when flagging a shift.
 * Comment must be non-empty (not just whitespace).
 */
export function validateFlagComment(comment: string): ValidationResult {
  if (!comment.trim()) return { valid: false, error: 'A comment is required when flagging a shift' }
  return { valid: true }
}

const POS_LINE_FIELDS = ['litres_sold', 'revenue_zar'] as const
export type PosLineField = typeof POS_LINE_FIELDS[number]

/**
 * Validates an OCR override before it is written to the audit trail.
 * - Value must be >= 0.
 * - Reason must be non-empty (not just whitespace).
 * - pos_line overrides must specify field_name as 'litres_sold' or 'revenue_zar'.
 */
export function validateOverride(input: {
  value:        number
  reason:       string
  reading_type: 'pump' | 'dip' | 'pos_line'
  field_name?:  string | null
}): ValidationResult {
  if (input.value < 0) return { valid: false, error: 'Override value must be zero or greater' }
  if (!input.reason.trim()) return { valid: false, error: 'A reason is required for overrides' }
  if (input.reading_type === 'pos_line') {
    if (!input.field_name || !(POS_LINE_FIELDS as readonly string[]).includes(input.field_name)) {
      return { valid: false, error: 'field_name must be litres_sold or revenue_zar for POS line overrides' }
    }
  }
  return { valid: true }
}
