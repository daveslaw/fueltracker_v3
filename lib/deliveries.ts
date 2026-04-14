import type { SupabaseClient } from '@supabase/supabase-js'

export type ShiftPeriod = 'morning' | 'evening'

/**
 * Determines which shift period a delivery timestamp falls into.
 * Morning: 00:00–11:59 UTC. Evening: 12:00–23:59 UTC.
 */
export function getShiftPeriod(deliveredAt: string): ShiftPeriod {
  const hour = new Date(deliveredAt).getUTCHours()
  return hour < 12 ? 'morning' : 'evening'
}

// ── Pure validation ───────────────────────────────────────────────────────────

export type DeliveryValidationResult =
  | { valid: true }
  | { valid: false; error: string }

export function validateDeliveryInput(params: {
  tankId: string
  litresReceived: number
  deliveryNoteUrl: string
}): DeliveryValidationResult {
  const { tankId, litresReceived, deliveryNoteUrl } = params

  if (!tankId || !tankId.trim()) {
    return { valid: false, error: 'Tank is required' }
  }
  if (litresReceived <= 0) {
    return { valid: false, error: 'Litres received must be greater than zero' }
  }
  if (!deliveryNoteUrl || !deliveryNoteUrl.trim()) {
    return { valid: false, error: 'Delivery receipt photo is required' }
  }

  return { valid: true }
}

// ── I/O ───────────────────────────────────────────────────────────────────────

export interface DeliveryRow {
  id:                string
  tank_id:           string
  litres_received:   number
  delivery_note_url: string | null
  delivered_at:      string
}

export async function createDelivery(
  db: SupabaseClient,
  params: {
    stationId:       string
    tankId:          string
    litresReceived:  number
    deliveryNoteUrl: string
    recordedBy:      string
  }
): Promise<{ data?: DeliveryRow; error?: string }> {
  const { data, error } = await db
    .from('deliveries')
    .insert({
      station_id:        params.stationId,
      tank_id:           params.tankId,
      litres_received:   params.litresReceived,
      delivery_note_url: params.deliveryNoteUrl,
      recorded_by:       params.recordedBy,
    })
    .select('id, tank_id, litres_received, delivery_note_url, delivered_at')
    .single()

  if (error) return { error: error.message }
  return { data: data as DeliveryRow }
}

export async function getShiftDeliveries(
  db: SupabaseClient,
  params: {
    stationId:  string
    shiftDate:  string   // YYYY-MM-DD
    period:     ShiftPeriod
  }
): Promise<DeliveryRow[]> {
  const dayStart = `${params.shiftDate}T00:00:00Z`
  const dayEnd   = `${params.shiftDate}T23:59:59Z`

  const { data } = await db
    .from('deliveries')
    .select('id, tank_id, litres_received, delivery_note_url, delivered_at')
    .eq('station_id', params.stationId)
    .gte('delivered_at', dayStart)
    .lte('delivered_at', dayEnd)
    .order('delivered_at', { ascending: true })

  return (data ?? []).filter(
    (d: DeliveryRow) => getShiftPeriod(d.delivered_at) === params.period
  )
}

export async function deleteDelivery(
  db: SupabaseClient,
  params: { deliveryId: string; stationId: string }
): Promise<{ error?: string }> {
  const { error } = await db
    .from('deliveries')
    .delete()
    .eq('id', params.deliveryId)
    .eq('station_id', params.stationId)

  if (error) return { error: error.message }
  return {}
}
