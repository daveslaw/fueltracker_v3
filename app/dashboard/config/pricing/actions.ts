'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { error: string } | { success: true }

export async function setPriceForGrade(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const fuel_grade_id  = formData.get('fuel_grade_id') as string
  const priceRaw       = formData.get('price_per_litre') as string
  const effective_from = (formData.get('effective_from') as string) || new Date().toISOString()

  if (!fuel_grade_id) return { error: 'Fuel grade is required' }

  const price_per_litre = parseFloat(priceRaw)
  if (isNaN(price_per_litre) || price_per_litre <= 0)
    return { error: 'Enter a valid price greater than zero' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Append-only: always INSERT, never UPDATE
  const { error } = await supabase.from('fuel_prices').insert({
    fuel_grade_id,
    price_per_litre,
    effective_from: new Date(effective_from).toISOString(),
    set_by: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/dashboard/config/pricing')
  return { success: true }
}
