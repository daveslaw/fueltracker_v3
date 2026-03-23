export type ShiftStatus = 'draft' | 'open' | 'pending_pos' | 'submitted' | 'approved' | 'flagged'
export type ReviewAction = 'approve' | 'flag'
export type ValidationResult = { valid: true } | { valid: false; error: string }

// States from which each action is permitted
const APPROVE_FROM = new Set<ShiftStatus>(['submitted', 'flagged'])
const FLAG_FROM    = new Set<ShiftStatus>(['submitted', 'approved'])

/**
 * Guards the approve/flag state machine.
 * Returns true only when the transition is a permitted move.
 */
export function canReview(status: ShiftStatus, action: ReviewAction): boolean {
  return action === 'approve' ? APPROVE_FROM.has(status) : FLAG_FROM.has(status)
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
