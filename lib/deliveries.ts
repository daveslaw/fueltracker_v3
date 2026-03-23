export type ShiftPeriod = 'morning' | 'evening'

/**
 * Determines which shift period a delivery timestamp falls into.
 * Morning: 00:00–11:59 UTC. Evening: 12:00–23:59 UTC.
 */
export function getShiftPeriod(deliveredAt: string): ShiftPeriod {
  const hour = new Date(deliveredAt).getUTCHours()
  return hour < 12 ? 'morning' : 'evening'
}
