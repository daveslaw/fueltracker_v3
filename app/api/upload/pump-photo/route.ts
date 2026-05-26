import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recogniser } from '@/lib/ocr'
import { validateUpload } from '@/lib/upload-validation'
import type { ImageRecogniser } from '@/lib/ocr/image-recogniser'

export function makeHandler(ocr: ImageRecogniser) {
  return async function POST(request: NextRequest) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const formData = await request.formData()
      const file = formData.get('file') as File
      const shiftId = formData.get('shiftId') as string
      const pumpId = formData.get('pumpId') as string

      if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file' }, { status: 400 })

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

      const path = `shifts/${shiftId}/pumps/${pumpId}-close-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('shift-photos')
        .upload(path, file, { contentType: file.type, upsert: true })

      if (uploadError) {
        console.error('[pump-photo] Storage upload error:', uploadError.message)
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }

      const { data: { publicUrl } } = supabase.storage.from('shift-photos').getPublicUrl(path)

      const arrayBuffer = await file.arrayBuffer()
      console.log('[pump-photo] arrayBuffer size:', arrayBuffer.byteLength)
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const ocrResult = await ocr.extractMeterReading(base64)
      console.log('[pump-photo] OCR result:', JSON.stringify(ocrResult))

      return NextResponse.json({ url: publicUrl, ocr: ocrResult })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[pump-photo] Unhandled error:', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }
}

export const POST = makeHandler(recogniser)
