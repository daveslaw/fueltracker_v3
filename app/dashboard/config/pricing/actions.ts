'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertOwner } from '@/lib/auth-assert'
import { hasPriceRangeOverlap } from '@/lib/pricing'

type ActionResult = { error: string } | { success: true }

export async function setPriceForGrade(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  await assertOwner(supabase)

  const fuel_grade_id      = formData.get('fuel_grade_id') as string
  const station_id         = formData.get('station_id') as string
  const sellRaw            = formData.get('sell_price_per_litre') as string
  const costRaw            = formData.get('cost_per_litre') as string
  const valid_from_raw     = (formData.get('valid_from') as string) || new Date().toISOString()

  if (!fuel_grade_id) return { error: 'Fuel grade is required' }
  if (!station_id)    return { error: 'Station is required' }

  const sell_price_per_litre = parseFloat(sellRaw)
  const cost_per_litre       = parseFloat(costRaw)
  if (isNaN(sell_price_per_litre) || sell_price_per_litre <= 0)
    return { error: 'Enter a valid selling price greater than zero' }
  if (isNaN(cost_per_litre) || cost_per_litre <= 0)
    return { error: 'Enter a valid cost price greater than zero' }

  const valid_from = new Date(valid_from_raw).toISOString()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Overlap guard: fetch existing rows for this station+grade, check for collision
  const { data: existing } = await supabase
    .from('fuel_prices')
    .select('valid_from, valid_to')
    .eq('station_id', station_id)
    .eq('fuel_grade_id', fuel_grade_id)

  if (hasPriceRangeOverlap(existing ?? [], { valid_from, valid_to: null }))
    return { error: 'This price range overlaps an existing entry. Close the existing range first.' }

  const { error } = await supabase.from('fuel_prices').insert({
    station_id,
    fuel_grade_id,
    sell_price_per_litre,
    cost_per_litre,
    valid_from,
    valid_to: null,
    set_by: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/dashboard/config/pricing')
  return { success: true }
}

export async function closePriceRange(priceId: string, valid_to: string): Promise<ActionResult> {
  const supabase = await createClient()
  await assertOwner(supabase)

  const { error } = await supabase
    .from('fuel_prices')
    .update({ valid_to: new Date(valid_to).toISOString() })
    .eq('id', priceId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/config/pricing')
  return { success: true }
}
