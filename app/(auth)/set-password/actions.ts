'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { validatePasswordInput } from '@/lib/user-management'

export async function setPassword(formData: FormData): Promise<{ error: string }> {
  const password = (formData.get('password') as string) ?? ''
  const confirm = (formData.get('confirm') as string) ?? ''

  const validationError = validatePasswordInput(password, confirm)
  if (validationError) return { error: validationError }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  redirect('/')
}
