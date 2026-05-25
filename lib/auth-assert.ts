import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

export function isActiveOwner(profile: { role: string; is_active: boolean } | null): boolean {
  return profile !== null && profile.is_active && profile.role === 'owner'
}

export async function assertOwner(supabase: SupabaseClient): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single()

  if (!isActiveOwner(profile)) return redirect('/login')
}
