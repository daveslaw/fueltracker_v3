'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertOwner } from '@/lib/auth-assert'
import { createSupabaseBaselinesRepository } from '@/lib/shift-baselines'

export async function savePumpBaseline(formData: FormData) {
  await assertOwner(await createClient())

  const stationId = formData.get('station_id') as string
  const pumpId    = formData.get('pump_id') as string
  const value     = parseFloat(formData.get('value') as string)

  if (!stationId || !pumpId || isNaN(value) || value < 0)
    return { error: 'Invalid pump baseline value' }

  const repo = createSupabaseBaselinesRepository(createAdminClient())
  const result = await repo.upsertPumpBaseline(stationId, pumpId, value)
  if (result.error) return result

  revalidatePath(`/dashboard/config/baselines?station=${stationId}`)
  return { success: true }
}

export async function saveTankBaseline(formData: FormData) {
  await assertOwner(await createClient())

  const stationId = formData.get('station_id') as string
  const tankId    = formData.get('tank_id') as string
  const value     = parseFloat(formData.get('value') as string)

  if (!stationId || !tankId || isNaN(value) || value < 0)
    return { error: 'Invalid tank baseline value' }

  const repo = createSupabaseBaselinesRepository(createAdminClient())
  const result = await repo.upsertTankBaseline(stationId, tankId, value)
  if (result.error) return result

  revalidatePath(`/dashboard/config/baselines?station=${stationId}`)
  return { success: true }
}
