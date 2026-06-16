import { verifyPin, shouldLockout } from '@/lib/pin-auth'
import type { SupabaseClient } from '@supabase/supabase-js'

const LOCKOUT_THRESHOLD = 10

export type PinSignInResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; locked: boolean; attemptsRemaining: number; error: string }

export function makePinSignIn(supabase: SupabaseClient | any) {
  return async function pinSignIn(
    userId: string,
    pin: string
  ): Promise<PinSignInResult> {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('pin_hash, pin_attempts, pin_locked')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      return { ok: false, locked: false, attemptsRemaining: 0, error: 'User not found' }
    }

    if (profile.pin_locked) {
      return { ok: false, locked: true, attemptsRemaining: 0, error: 'Account locked' }
    }

    if (!profile.pin_hash) {
      return { ok: false, locked: false, attemptsRemaining: 0, error: 'PIN not set' }
    }

    const valid = await verifyPin(pin, profile.pin_hash)

    if (!valid) {
      const newAttempts = profile.pin_attempts + 1
      const locked = shouldLockout(newAttempts)
      await supabase
        .from('user_profiles')
        .update({ pin_attempts: newAttempts, ...(locked ? { pin_locked: true } : {}) })
        .eq('id', userId)
      return {
        ok: false,
        locked,
        attemptsRemaining: locked ? 0 : LOCKOUT_THRESHOLD - newAttempts,
        error: locked ? 'Account locked after too many attempts' : 'Incorrect PIN',
      }
    }

    await supabase
      .from('user_profiles')
      .update({ pin_attempts: 0 })
      .eq('id', userId)

    const { data: sessionData, error: sessionError } =
      await supabase.auth.admin.createSession({ user_id: userId })

    if (sessionError || !sessionData?.session) {
      return { ok: false, locked: false, attemptsRemaining: 0, error: 'Failed to create session' }
    }

    return {
      ok: true,
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    }
  }
}
