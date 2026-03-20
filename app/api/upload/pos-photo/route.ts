import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractPosLines } from '@/lib/ocr/vision-client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const shiftId = formData.get('shiftId') as string

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!shiftId) return NextResponse.json({ error: 'Missing shiftId' }, { status: 400 })

  // Upload to Supabase Storage
  const path = `shifts/${shiftId}/pos/z-report-${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('shift-photos')
    .upload(path, file, { contentType: 'image/jpeg', upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('shift-photos').getPublicUrl(path)

  // Run POS OCR
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const ocr = await extractPosLines(base64)

  return NextResponse.json({ url: publicUrl, ocr })
}
