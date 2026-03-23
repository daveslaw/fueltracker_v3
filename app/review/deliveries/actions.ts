'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runReconciliation } from '@/lib/reconciliation-runner'
import { getShiftPeriod } from '@/lib/deliveries'

type ActionResult = { error: string } | { success: true }

// ── recordDelivery ─────────────────────────────────────────────────────────────

export async function recordDelivery(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const tank_id          = formData.get('tank_id') as string
  const station_id       = formData.get('station_id') as string
  const litres_received  = parseFloat(formData.get('litres_received') as string)
  const delivery_note_url = (formData.get('delivery_note_url') as string) || null
  const delivered_at_raw  = formData.get('delivered_at') as string

  if (!tank_id)                      return { error: 'Tank is required' }
  if (!station_id)                   return { error: 'Station is required' }
  if (isNaN(litres_received) || litres_received <= 0)
    return { error: 'Enter a valid litres received (must be > 0)' }

  // Resolve profile for recorded_by
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase
    .from('user_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) return { error: 'User profile not found' }

  const delivered_at = delivered_at_raw
    ? new Date(delivered_at_raw).toISOString()
    : new Date().toISOString()

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .insert({
      station_id,
      tank_id,
      litres_received,
      delivery_note_url,
      delivered_at,
      recorded_by: profile.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Re-run reconciliation for the affected shift (if it exists and is submitted)
  await rerunReconciliationForDelivery(station_id, delivered_at)

  revalidatePath('/review/deliveries')
  return { success: true }
}

// ── editDelivery ───────────────────────────────────────────────────────────────

export async function editDelivery(
  deliveryId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()

  const litres_received   = parseFloat(formData.get('litres_received') as string)
  const delivered_at_raw  = formData.get('delivered_at') as string

  if (isNaN(litres_received) || litres_received <= 0)
    return { error: 'Enter a valid litres received (must be > 0)' }

  const delivered_at = delivered_at_raw
    ? new Date(delivered_at_raw).toISOString()
    : undefined

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .update({ litres_received, ...(delivered_at ? { delivered_at } : {}), updated_at: new Date().toISOString() })
    .eq('id', deliveryId)
    .select('station_id, delivered_at')
    .single()
  if (error) return { error: error.message }

  await rerunReconciliationForDelivery(delivery.station_id, delivery.delivered_at)

  revalidatePath('/review/deliveries')
  return { success: true }
}

// ── internal: find and re-run reconciliation for the shift covering a delivery ─

async function rerunReconciliationForDelivery(stationId: string, deliveredAt: string) {
  const admin = createAdminClient()
  const date   = deliveredAt.split('T')[0]
  const period = getShiftPeriod(deliveredAt)

  const { data: shift } = await admin
    .from('shifts')
    .select('id, status')
    .eq('station_id', stationId)
    .eq('shift_date', date)
    .eq('period', period)
    .eq('status', 'submitted')
    .maybeSingle()

  if (shift) {
    await runReconciliation(shift.id)
  }
}
