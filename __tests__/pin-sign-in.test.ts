import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { makePinSignIn } from '@/lib/pin-sign-in'
import { hashPin } from '@/lib/pin-auth'

type ProfileRow = {
  pin_hash: string | null
  pin_attempts: number
  pin_locked: boolean
  user_id?: string
}

type MockOptions = {
  profile: ProfileRow | null
  email?: string | null
  sessionTokens?: { access_token: string; refresh_token: string }
}

function makeSupabase({ profile, email, sessionTokens }: MockOptions) {
  const updates: Record<string, unknown>[] = []
  const generateLinkCalls: Record<string, unknown>[] = []
  const getUserByIdCalls: string[] = []

  function makeChain() {
    const chain: Record<string, unknown> = {}
    chain['select'] = () => chain
    chain['eq'] = () => chain
    chain['single'] = () =>
      Promise.resolve(
        profile
          ? { data: profile, error: null }
          : { data: null, error: { message: 'not found' } }
      )
    chain['update'] = (data: Record<string, unknown>) => {
      updates.push(data)
      return { eq: () => Promise.resolve({ error: null }) }
    }
    return chain
  }

  return {
    from: () => makeChain(),
    auth: {
      admin: {
        getUserById: async (id: string) => {
          getUserByIdCalls.push(id)
          return email
            ? { data: { user: { email } }, error: null }
            : { data: { user: null }, error: { message: 'user not found' } }
        },
        generateLink: async (params: Record<string, unknown>) => {
          generateLinkCalls.push(params)
          return sessionTokens
            ? { data: { properties: { hashed_token: 'token-hash' } }, error: null }
            : { data: null, error: { message: 'generateLink failed' } }
        },
      },
      verifyOtp: async () =>
        sessionTokens
          ? { data: { session: sessionTokens }, error: null }
          : { data: { session: null }, error: { message: 'verifyOtp failed' } },
    },
    _updates: updates,
    _generateLinkCalls: generateLinkCalls,
    _getUserByIdCalls: getUserByIdCalls,
  }
}

describe('makePinSignIn', () => {
  let correctHash: string

  beforeEach(async () => {
    correctHash = await hashPin('1234')
  })

  it('tracer bullet: correct PIN returns ok with access and refresh tokens', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 0, pin_locked: false },
      email: 'user1@example.com',
      sessionTokens: { access_token: 'acc', refresh_token: 'ref' },
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    const result = await signIn('user-1', '1234')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.accessToken).toBe('acc')
      expect(result.refreshToken).toBe('ref')
    }
  })

  it('looks up the auth user via profile.user_id, not the user_profiles row id passed in', async () => {
    const supabase = makeSupabase({
      profile: {
        pin_hash: correctHash,
        pin_attempts: 0,
        pin_locked: false,
        user_id: 'auth-user-99',
      },
      email: 'user1@example.com',
      sessionTokens: { access_token: 'acc', refresh_token: 'ref' },
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    await signIn('profile-id-1', '1234')
    expect(supabase._getUserByIdCalls[0]).toBe('auth-user-99')
  })

  it('uses the email from getUserById, not a stale user_profiles.email', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 0, pin_locked: false },
      email: 'canonical@example.com',
      sessionTokens: { access_token: 'acc', refresh_token: 'ref' },
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    await signIn('user-1', '1234')
    expect(supabase._generateLinkCalls[0]).toMatchObject({ email: 'canonical@example.com' })
  })

  it('no resolvable email returns a setup error without calling generateLink', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 0, pin_locked: false },
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    const result = await signIn('user-1', '1234')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Account not fully set up — contact an owner')
    }
    expect(supabase._generateLinkCalls).toHaveLength(0)
  })

  it('session-minting failure returns a generic failure error', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 0, pin_locked: false },
      email: 'user1@example.com',
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    const result = await signIn('user-1', '1234')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Failed to create session')
    }
  })

  it('logs session-minting failures with a [pin-sign-in] prefix', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 0, pin_locked: false },
      email: 'user1@example.com',
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    await signIn('user-1', '1234')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[pin-sign-in]'),
      expect.anything()
    )
    consoleErrorSpy.mockRestore()
  })

  it('correct PIN resets pin_attempts to 0', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 3, pin_locked: false },
      email: 'user1@example.com',
      sessionTokens: { access_token: 'acc', refresh_token: 'ref' },
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    await signIn('user-1', '1234')
    expect(supabase._updates[0]).toMatchObject({ pin_attempts: 0 })
  })

  it('wrong PIN returns ok:false and increments attempts', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 2, pin_locked: false },
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    const result = await signIn('user-1', '9999')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.attemptsRemaining).toBe(7) // 10 - 3
    }
    expect(supabase._updates[0]).toMatchObject({ pin_attempts: 3 })
  })

  it('10th failed attempt sets pin_locked and returns 0 remaining', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 9, pin_locked: false },
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    const result = await signIn('user-1', '9999')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.locked).toBe(true)
      expect(result.attemptsRemaining).toBe(0)
    }
    expect(supabase._updates[0]).toMatchObject({ pin_attempts: 10, pin_locked: true })
  })

  it('locked user is rejected even with the correct PIN', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 10, pin_locked: true },
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    const result = await signIn('user-1', '1234')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.locked).toBe(true)
    }
  })

  it('unknown user returns ok:false with an error', async () => {
    const supabase = makeSupabase({ profile: null })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    const result = await signIn('unknown-user', '1234')
    expect(result.ok).toBe(false)
  })

  it('user with no PIN set returns ok:false', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: null, pin_attempts: 0, pin_locked: false },
    })
    const signIn = makePinSignIn(supabase as unknown as SupabaseClient)
    const result = await signIn('user-1', '1234')
    expect(result.ok).toBe(false)
  })
})
