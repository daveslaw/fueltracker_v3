'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateStation, validateTank, validatePump, revalidateStationConfig } from '@/lib/station-config'

type ActionResult = { error: string } | { success: true }

// ── Stations ─────────────────────────────────────────────────────────────────

export async function createStation(formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string) ?? ''
  const address = (formData.get('address') as string) || null

  const error = validateStation({ name })
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('stations').insert({ name: name.trim(), address })
  if (dbError) return { error: dbError.message }

  revalidateStationConfig()
  revalidatePath('/dashboard/config')
  return { success: true }
}

export async function updateStation(id: string, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string) ?? ''
  const address = (formData.get('address') as string) || null

  const error = validateStation({ name })
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase
    .from('stations')
    .update({ name: name.trim(), address })
    .eq('id', id)
  if (dbError) return { error: dbError.message }

  revalidateStationConfig()
  revalidatePath('/dashboard/config')
  return { success: true }
}

// ── Tanks ────────────────────────────────────────────────────────────────────

export async function createTank(stationId: string, formData: FormData): Promise<ActionResult> {
  const label = (formData.get('label') as string) ?? ''
  const fuel_grade_id = (formData.get('fuel_grade_id') as string) ?? ''
  const capacity_litres = parseFloat((formData.get('capacity_litres') as string) ?? '0')

  const error = validateTank({ label, fuel_grade_id, capacity_litres })
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase
    .from('tanks')
    .insert({ station_id: stationId, label: label.trim(), fuel_grade_id, capacity_litres })
  if (dbError) return { error: dbError.message }

  revalidateStationConfig()
  revalidatePath('/dashboard/config')
  return { success: true }
}

export async function updateTank(id: string, formData: FormData): Promise<ActionResult> {
  const label = (formData.get('label') as string) ?? ''
  const fuel_grade_id = (formData.get('fuel_grade_id') as string) ?? ''
  const capacity_litres = parseFloat((formData.get('capacity_litres') as string) ?? '0')

  const error = validateTank({ label, fuel_grade_id, capacity_litres })
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase
    .from('tanks')
    .update({ label: label.trim(), fuel_grade_id, capacity_litres })
    .eq('id', id)
  if (dbError) return { error: dbError.message }

  revalidateStationConfig()
  revalidatePath('/dashboard/config')
  return { success: true }
}

// ── Pumps ────────────────────────────────────────────────────────────────────

export async function createPump(stationId: string, formData: FormData): Promise<ActionResult> {
  const label = (formData.get('label') as string) ?? ''
  const tank_id = (formData.get('tank_id') as string) ?? ''

  const error = validatePump({ label, tank_id })
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase
    .from('pumps')
    .insert({ station_id: stationId, tank_id, label: label.trim() })
  if (dbError) return { error: dbError.message }

  revalidateStationConfig()
  revalidatePath('/dashboard/config')
  return { success: true }
}

export async function updatePump(id: string, formData: FormData): Promise<ActionResult> {
  const label = (formData.get('label') as string) ?? ''
  const tank_id = (formData.get('tank_id') as string) ?? ''

  const error = validatePump({ label, tank_id })
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase
    .from('pumps')
    .update({ label: label.trim(), tank_id })
    .eq('id', id)
  if (dbError) return { error: dbError.message }

  revalidateStationConfig()
  revalidatePath('/dashboard/config')
  return { success: true }
}
