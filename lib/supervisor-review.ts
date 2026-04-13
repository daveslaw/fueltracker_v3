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

/**
 * Validates an OCR override before it is written to the audit trail.
 * Value must be >= 0. Reason must be non-empty (not just whitespace).
 */
export function validateOverride(input: { value: number; reason: string }): ValidationResult {
  if (input.value < 0) return { valid: false, error: 'Override value must be zero or greater' }
  if (!input.reason.trim()) return { valid: false, error: 'A reason is required for overrides' }
  return { valid: true }
}
