import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const shiftId = formData.get('shiftId') as string
  const pumpId = formData.get('pumpId') as string

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const path = `shifts/${shiftId}/pumps/${pumpId}-open-${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('shift-photos')
    .upload(path, file, { contentType: 'image/jpeg', upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('shift-photos').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
