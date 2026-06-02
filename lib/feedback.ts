export const FEEDBACK_CATEGORIES = [
  'Something is not working',
  'The numbers look wrong',
  "I don't understand this",
  'Other',
] as const

export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number]

export interface FeedbackDeviceInfo {
  userAgent: string
  screenWidth: number
  screenHeight: number
}

export interface FeedbackError {
  message: string
  timestamp: number
}

export interface FeedbackContextPayload {
  stationName: string | null
  userName: string
  role: string
  shiftId: string | null
  route: string
  deviceInfo: FeedbackDeviceInfo
  recentErrors: FeedbackError[]
  routeBreadcrumbs: string[]
}

export function buildFeedbackContext(inputs: {
  stationName: string | null
  userName: string
  role: string
  shiftId?: string | null
  route: string
  deviceInfo: FeedbackDeviceInfo
  recentErrors: FeedbackError[]
  routeBreadcrumbs: string[]
}): FeedbackContextPayload {
  return {
    stationName: inputs.stationName,
    userName: inputs.userName,
    role: inputs.role,
    shiftId: inputs.shiftId ?? null,
    route: inputs.route,
    deviceInfo: inputs.deviceInfo,
    recentErrors: inputs.recentErrors,
    routeBreadcrumbs: inputs.routeBreadcrumbs,
  }
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export const NOTE_MAX_LENGTH = 500

export function validateFeedback(
  category: string,
  note: string | null | undefined,
): ValidationResult {
  if (!(FEEDBACK_CATEGORIES as readonly string[]).includes(category)) {
    return { valid: false, reason: 'Invalid category.' }
  }
  if (note && note.length > NOTE_MAX_LENGTH) {
    return { valid: false, reason: `Note must be ${NOTE_MAX_LENGTH} characters or fewer.` }
  }
  return { valid: true }
}
