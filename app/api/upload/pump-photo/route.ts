import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recogniser } from '@/lib/ocr'
import type { ImageRecogniser } from '@/lib/ocr/image-recogniser'

export function makeHandler(ocr: ImageRecogniser) {
  return async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const shiftId = formData.get('shiftId') as string
    const pumpId = formData.get('pumpId') as string

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const path = `shifts/${shiftId}/pumps/${pumpId}-open-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('shift-photos')
      .upload(path, file, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('shift-photos').getPublicUrl(path)

    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const ocrResult = await ocr.extractMeterReading(base64)

    return NextResponse.json({ url: publicUrl, ocr: ocrResult })
  }
}

export const POST = makeHandler(recogniser)
