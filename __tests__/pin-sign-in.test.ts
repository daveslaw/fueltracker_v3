import { describe, it, expect, vi } from 'vitest'
import { makePinSignIn, type PinSignInResult } from '@/lib/pin-sign-in'

// ── Fake Supabase client ─────────────────────────────────────────────────────

type FakeClientOptions = {
  /** If set, getUserById fails with this error */
  getUserByIdError?: Error | null
  /** If set, getUserById returns a user with no email */
  noEmail?: boolean
  /** If set, generateLink fails with this error */
  generateLinkError?: Error | null
  /** If set, generateLink returns no hashed_token */
  noTokenHash?: boolean
  /** If set, verifyOtp fails with this error */
  verifyOtpError?: Error | null
  /** If set, verifyOtp returns no session */
  noSession?: boolean
}

function createFakeSupabase(opts: FakeClientOptions = {}) {
  const userEmail = opts.noEmail ? null : 'supervisor@elegant-amaglug.co.za'
  const tokenHash = opts.noTokenHash ? null : 'mock-token-hash-abc123'
  const accessToken = opts.noSession ? null : 'mock-access-token'
  const refreshToken = opts.noSession ? null : 'mock-refresh-token'

  return {
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue(
          opts.getUserByIdError
            ? { data: null, error: opts.getUserByIdError }
            : {
                data: {
                  user: { id: 'user-1', email: userEmail },
                },
                error: null,
              }
        ),
        generateLink: vi.fn().mockResolvedValue(
          opts.generateLinkError
            ? { data: null, error: opts.generateLinkError }
            : {
                data: {
                  properties: { hashed_token: tokenHash },
                },
                error: null,
              }
        ),
      },
      verifyOtp: vi.fn().mockResolvedValue(
        opts.verifyOtpError
          ? { data: null, error: opts.verifyOtpError }
          : {
              data: {
                session: accessToken
                  ? { access_token: accessToken, refresh_token: refreshToken }
                  : null,
              },
              error: null,
            }
      ),
    },
  } as any
}

// ── makePinSignIn ────────────────────────────────────────────────────────────

describe('makePinSignIn', () => {
  const userId = 'user-1'

  it('tracer bullet: valid user PIN → returns session tokens', async () => {
    const supabase = createFakeSupabase()
    const pinSignIn = makePinSignIn(supabase)

    const result = await pinSignIn(userId, '1234')

    expect(result).toEqual({
      ok: true,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    })
  })

  it('getUserById fails → returns account-not-setup error', async () => {
    const supabase = createFakeSupabase({ getUserByIdError: new Error('User not found') })
    const pinSignIn = makePinSignIn(supabase)

    const result = await pinSignIn(userId, '1234')

    expect(result).toEqual({
      ok: false,
      locked: false,
      attemptsRemaining: 0,
      error: 'Account not fully set up — contact an owner',
    })
  })

  it('getUserById returns no email → returns account-not-setup error', async () => {
    const supabase = createFakeSupabase({ noEmail: true })
    const pinSignIn = makePinSignIn(supabase)

    const result = await pinSignIn(userId, '1234')

    expect(result).toEqual({
      ok: false,
      locked: false,
      attemptsRemaining: 0,
      error: 'Account not fully set up — contact an owner',
    })
  })

  it('generateLink fails → returns generic session error', async () => {
    const supabase = createFakeSupabase({ generateLinkError: new Error('Rate limited') })
    const pinSignIn = makePinSignIn(supabase)

    const result = await pinSignIn(userId, '1234')

    expect(result).toEqual({
      ok: false,
      locked: false,
      attemptsRemaining: 0,
      error: 'Failed to create session',
    })
  })

  it('generateLink returns no token hash → returns generic session error', async () => {
    const supabase = createFakeSupabase({ noTokenHash: true })
    const pinSignIn = makePinSignIn(supabase)

    const result = await pinSignIn(userId, '1234')

    expect(result).toEqual({
      ok: false,
      locked: false,
      attemptsRemaining: 0,
      error: 'Failed to create session',
    })
  })

  it('verifyOtp fails → returns generic session error', async () => {
    const supabase = createFakeSupabase({ verifyOtpError: new Error('Invalid token') })
    const pinSignIn = makePinSignIn(supabase)

    const result = await pinSignIn(userId, '1234')

    expect(result).toEqual({
      ok: false,
      locked: false,
      attemptsRemaining: 0,
      error: 'Failed to create session',
    })
  })

  it('verifyOtp returns no session → returns generic session error', async () => {
    const supabase = createFakeSupabase({ noSession: true })
    const pinSignIn = makePinSignIn(supabase)

    const result = await pinSignIn(userId, '1234')

    expect(result).toEqual({
      ok: false,
      locked: false,
      attemptsRemaining: 0,
      error: 'Failed to create session',
    })
  })

  it('unknown userId still goes through error path', async () => {
    const supabase = createFakeSupabase({ getUserByIdError: new Error('User not found') })
    const pinSignIn = makePinSignIn(supabase)

    const result = await pinSignIn('nonexistent-user', '1234')

    expect(result.ok).toBe(false)
    expect(result).toHaveProperty('error')
  })
})
