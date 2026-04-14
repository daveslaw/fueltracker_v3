'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signInWithPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Clear any stale session from a previous user before signing in
  await supabase.auth.signOut()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  console.log('[login] signInWithPassword result:', error ?? 'success')
  if (error) return { error: error.message }

  // Middleware handles role-based redirect from /
  console.log('[login] redirecting to /')
  redirect('/')
}

export async function signInWithMagicLink(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) return { error: error.message }

  return { message: 'Check your email for the login link.' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
