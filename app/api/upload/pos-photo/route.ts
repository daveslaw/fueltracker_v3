import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recogniser } from '@/lib/ocr'
import { validateUpload } from '@/lib/upload-validation'
import type { ImageRecogniser } from '@/lib/ocr/image-recogniser'

export function makeHandler(ocr: ImageRecogniser) {
  return async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const shiftId = formData.get('shiftId') as string

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (!shiftId) return NextResponse.json({ error: 'Missing shiftId' }, { status: 400 })

    const validationError = validateUpload(file)
    if (validationError) return NextResponse.json(validationError, { status: 400 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('station_id')
      .eq('user_id', user.id)
      .single()
    const { data: shift } = await supabase
      .from('shifts')
      .select('station_id')
      .eq('id', shiftId)
      .eq('station_id', profile?.station_id ?? '')
      .single()
    if (!shift) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const path = `shifts/${shiftId}/pos/z-report-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('shift-photos')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('shift-photos').getPublicUrl(path)

    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const ocrResult = await ocr.extractPosLines(base64)

    return NextResponse.json({ url: publicUrl, ocr: ocrResult })
  }
}

export const POST = makeHandler(recogniser)
