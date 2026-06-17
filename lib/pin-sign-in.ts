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
      .select('pin_hash, pin_attempts, pin_locked, user_id')
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

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      profile.user_id
    )
    const email = userData?.user?.email

    if (userError || !email) {
      return {
        ok: false,
        locked: false,
        attemptsRemaining: 0,
        error: 'Account not fully set up — contact an owner',
      }
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const tokenHash = linkData?.properties?.hashed_token

    if (linkError || !tokenHash) {
      console.error('[pin-sign-in] generateLink failed:', linkError)
      return { ok: false, locked: false, attemptsRemaining: 0, error: 'Failed to create session' }
    }

    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })

    if (otpError || !otpData?.session) {
      console.error('[pin-sign-in] verifyOtp failed:', otpError)
      return { ok: false, locked: false, attemptsRemaining: 0, error: 'Failed to create session' }
    }

    return {
      ok: true,
      accessToken: otpData.session.access_token,
      refreshToken: otpData.session.refresh_token,
    }
  }
}
