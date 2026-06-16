import { describe, it, expect, beforeEach } from 'vitest'
import { makePinSignIn } from '@/lib/pin-sign-in'
import { hashPin } from '@/lib/pin-auth'

type ProfileRow = {
  pin_hash: string | null
  pin_attempts: number
  pin_locked: boolean
}

type MockOptions = {
  profile: ProfileRow | null
  sessionTokens?: { access_token: string; refresh_token: string }
}

function makeSupabase({ profile, sessionTokens }: MockOptions) {
  const updates: Record<string, unknown>[] = []

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
        createSession: async () =>
          sessionTokens
            ? { data: { session: sessionTokens }, error: null }
            : { data: null, error: { message: 'session creation failed' } },
      },
    },
    _updates: updates,
  } as any
}

describe('makePinSignIn', () => {
  let correctHash: string

  beforeEach(async () => {
    correctHash = await hashPin('1234')
  })

  it('tracer bullet: correct PIN returns ok with access and refresh tokens', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 0, pin_locked: false },
      sessionTokens: { access_token: 'acc', refresh_token: 'ref' },
    })
    const signIn = makePinSignIn(supabase)
    const result = await signIn('user-1', '1234')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.accessToken).toBe('acc')
      expect(result.refreshToken).toBe('ref')
    }
  })

  it('correct PIN resets pin_attempts to 0', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 3, pin_locked: false },
      sessionTokens: { access_token: 'acc', refresh_token: 'ref' },
    })
    const signIn = makePinSignIn(supabase)
    await signIn('user-1', '1234')
    expect(supabase._updates[0]).toMatchObject({ pin_attempts: 0 })
  })

  it('wrong PIN returns ok:false and increments attempts', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: correctHash, pin_attempts: 2, pin_locked: false },
    })
    const signIn = makePinSignIn(supabase)
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
    const signIn = makePinSignIn(supabase)
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
    const signIn = makePinSignIn(supabase)
    const result = await signIn('user-1', '1234')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.locked).toBe(true)
    }
  })

  it('unknown user returns ok:false with an error', async () => {
    const supabase = makeSupabase({ profile: null })
    const signIn = makePinSignIn(supabase)
    const result = await signIn('unknown-user', '1234')
    expect(result.ok).toBe(false)
  })

  it('user with no PIN set returns ok:false', async () => {
    const supabase = makeSupabase({
      profile: { pin_hash: null, pin_attempts: 0, pin_locked: false },
    })
    const signIn = makePinSignIn(supabase)
    const result = await signIn('user-1', '1234')
    expect(result.ok).toBe(false)
  })
})
