'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateInvite, INVITABLE_ROLES } from '@/lib/user-management'

type ActionResult = { error: string } | { success: true }

// ── Invite user ──────────────────────────────────────────────────────────────

export async function inviteUser(formData: FormData): Promise<ActionResult> {
  const email = (formData.get('email') as string) ?? ''
  const role = (formData.get('role') as string) ?? ''
  const station_id = (formData.get('station_id') as string) ?? ''

  const error = validateInvite({ email, role, station_id })
  if (error) return { error }

  const admin = createAdminClient()

  const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim())
  if (inviteError) return { error: inviteError.message }

  const { error: profileError } = await admin.from('user_profiles').insert({
    user_id: data.user.id,
    role,
    station_id,
    is_active: true,
    email: email.trim(),
  })
  if (profileError) return { error: profileError.message }

  revalidatePath('/dashboard/users')
  return { success: true }
}

// ── Update role / station ────────────────────────────────────────────────────

export async function updateUserProfile(
  profileId: string,
  formData: FormData
): Promise<ActionResult> {
  const role = (formData.get('role') as string) ?? ''
  const station_id = (formData.get('station_id') as string) ?? ''

  if (!(INVITABLE_ROLES as readonly string[]).includes(role))
    return { error: `Invalid role — must be one of: ${INVITABLE_ROLES.join(', ')}` }
  if (!station_id) return { error: 'A station must be assigned' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .update({ role, station_id })
    .eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/users')
  return { success: true }
}

// ── Deactivate / reactivate ──────────────────────────────────────────────────

export async function setUserActive(profileId: string, is_active: boolean): Promise<ActionResult> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .update({ is_active })
    .eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/users')
  return { success: true }
}
