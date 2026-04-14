import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const shiftId = formData.get('shiftId') as string

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!shiftId) return NextResponse.json({ error: 'shiftId required' }, { status: 400 })

  const path = `shifts/${shiftId}/deliveries/${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('delivery-photos')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('delivery-photos').getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
