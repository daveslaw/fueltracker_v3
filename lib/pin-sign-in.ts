/**
 * PIN-based sign-in session minting for station tablets.
 *
 * Replaces the original approach that used the nonexistent
 * `auth.admin.createSession()` with a working three-step flow:
 *   getUserById → generateLink → verifyOtp
 *
 * The (userId, pin) → PinSignInResult signature is the public contract.
 * PIN hash/verify/lockout are delegated to lib/pin-auth.ts.
 */

import { type SupabaseClient } from '@supabase/supabase-js'

export type PinSignInResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; locked: boolean; attemptsRemaining: number; error: string }

/**
 * Factory that accepts a Supabase client (admin privileges) and returns
 * a pinSignIn function.
 *
 * The caller is responsible for:
 * 1. Verifying the user's PIN and lockout status (via lib/pin-auth.ts)
 * 2. Passing the verified userId and pin to the returned function
 */
export function makePinSignIn(supabase: SupabaseClient) {
  return async (userId: string, _pin: string): Promise<PinSignInResult> => {
    try {
      // Step 1: Get canonical email from auth.users (not denormalised user_profiles)
      const { data: userData, error: userError } =
        await supabase.auth.admin.getUserById(userId)

      if (userError || !userData?.user?.email) {
        console.error('[pin-sign-in] getUserById failed', userError)
        return {
          ok: false,
          locked: false,
          attemptsRemaining: 0,
          error: 'Account not fully set up — contact an owner',
        }
      }

      const email = userData.user.email

      // Step 2: Generate a magic-link token hash (no email is sent)
      const { data: linkData, error: linkError } =
        await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email,
        })

      if (linkError || !linkData?.properties?.hashed_token) {
        console.error('[pin-sign-in] generateLink failed', linkError)
        return {
          ok: false,
          locked: false,
          attemptsRemaining: 0,
          error: 'Failed to create session',
        }
      }

      const tokenHash = linkData.properties.hashed_token

      // Step 3: Exchange token hash for a real session on a non-admin client
      const { data: otpData, error: otpError } =
        await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink',
        })

      if (otpError || !otpData?.session) {
        console.error('[pin-sign-in] verifyOtp failed', otpError)
        return {
          ok: false,
          locked: false,
          attemptsRemaining: 0,
          error: 'Failed to create session',
        }
      }

      return {
        ok: true,
        accessToken: otpData.session.access_token,
        refreshToken: otpData.session.refresh_token,
      }
    } catch (err) {
      console.error('[pin-sign-in] unexpected error', err)
      return {
        ok: false,
        locked: false,
        attemptsRemaining: 0,
        error: 'Failed to create session',
      }
    }
  }
}
