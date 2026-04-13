'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canStartShift } from '@/lib/shift-open'
import type { ShiftRow, ShiftPeriod } from '@/lib/shift-open'

// ── createShiftSlot ───────────────────────────────────────────────────────────
// Owner pre-creates a pending shift slot for a station + date + period.
// Supervisors pick it up via app/shift/page.tsx.

export async function createShiftSlot(formData: FormData) {
  const supabase = await createClient()

  const station_id = formData.get('station_id') as string
  const period     = formData.get('period') as ShiftPeriod
  const shift_date = formData.get('shift_date') as string

  if (!station_id || !period || !shift_date)
    return { error: 'Station, period, and date are required' }

  // Duplicate guard
  const { data: existing } = await supabase
    .from('shifts')
    .select('station_id, period, shift_date, status')
    .eq('station_id', station_id)
    .eq('shift_date', shift_date)

  if (!canStartShift((existing ?? []) as ShiftRow[], station_id, period, shift_date))
    return { error: `A ${period} shift for this station on ${shift_date} already exists.` }

  const { error } = await supabase
    .from('shifts')
    .insert({ station_id, period, shift_date, status: 'pending' })
  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
