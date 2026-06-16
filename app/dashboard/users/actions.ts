'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertOwner } from '@/lib/auth-assert'
import { validateInvite, validatePin, INVITABLE_ROLES, buildInviteCallbackUrl } from '@/lib/user-management'
import { hashPin } from '@/lib/pin-auth'

type ActionResult = { error: string } | { success: true }

// ── Invite user ──────────────────────────────────────────────────────────────

export async function inviteUser(formData: FormData): Promise<ActionResult> {
  await assertOwner(await createClient())

  const email = (formData.get('email') as string) ?? ''
  const role = (formData.get('role') as string) ?? ''
  const station_id = (formData.get('station_id') as string) ?? ''
  const full_name = (formData.get('full_name') as string) ?? ''

  const error = validateInvite({ email, role, station_id, full_name })
  if (error) return { error }

  const admin = createAdminClient()

  const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: buildInviteCallbackUrl(process.env.NEXT_PUBLIC_SITE_URL),
  })
  if (inviteError) return { error: inviteError.message }

  const { error: profileError } = await admin.from('user_profiles').insert({
    user_id: data.user.id,
    role,
    station_id,
    is_active: true,
    email: email.trim(),
    full_name: full_name.trim(),
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
  await assertOwner(await createClient())

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

// ── Set PIN ──────────────────────────────────────────────────────────────────

export async function setUserPin(
  profileId: string,
  formData: FormData
): Promise<ActionResult> {
  await assertOwner(await createClient())

  const pin = (formData.get('pin') as string) ?? ''
  const confirm = (formData.get('pin_confirm') as string) ?? ''

  const pinError = validatePin(pin)
  if (pinError) return { error: pinError }
  if (pin !== confirm) return { error: 'PINs do not match' }

  const pin_hash = await hashPin(pin)
  const admin = createAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .update({ pin_hash, pin_attempts: 0, pin_locked: false })
    .eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/users')
  return { success: true }
}

// ── Unlock PIN ───────────────────────────────────────────────────────────────

export async function unlockUserPin(profileId: string): Promise<ActionResult> {
  await assertOwner(await createClient())

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .update({ pin_locked: false, pin_attempts: 0 })
    .eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/users')
  return { success: true }
}

// ── Deactivate / reactivate ──────────────────────────────────────────────────

export async function setUserActive(profileId: string, is_active: boolean): Promise<ActionResult> {
  await assertOwner(await createClient())

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .update({ is_active })
    .eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/users')
  return { success: true }
}
