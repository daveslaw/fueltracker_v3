import type { SupabaseClient } from '@supabase/supabase-js'

export type PosNozzleLineInput = {
  pump_id: string
  litres_sold: number
  revenue_zar: number
  ocr_status?: 'auto' | 'manual_override' | 'unreadable'
}

export function hasManualEntry(lines: PosNozzleLineInput[]): boolean {
  return lines.some(l => l.ocr_status !== undefined && l.ocr_status !== 'auto')
}

export async function savePosLines(
  db: SupabaseClient,
  shiftId: string,
  photoUrl: string | null,
  rawOcr: unknown,
  lines: PosNozzleLineInput[],
): Promise<{ error?: string }> {
  if (!lines.length) return { error: 'At least one pump line is required' }

  const { data: submission, error: subErr } = await db
    .from('pos_submissions')
    .upsert({ shift_id: shiftId, photo_url: photoUrl, raw_ocr: rawOcr }, { onConflict: 'shift_id' })
    .select('id')
    .single()
  if (subErr) return { error: subErr.message }

  await db.from('pos_submission_lines').delete().eq('pos_submission_id', submission.id)

  const { error: linesErr } = await db.from('pos_submission_lines').insert(
    lines.map(l => ({
      pos_submission_id: submission.id,
      pump_id: l.pump_id,
      litres_sold: l.litres_sold,
      revenue_zar: l.revenue_zar,
      ocr_status: l.ocr_status ?? 'auto',
    }))
  )
  if (linesErr) return { error: linesErr.message }

  if (hasManualEntry(lines)) {
    await db.from('shifts').update({ has_manual_entry: true }).eq('id', shiftId)
  }

  return {}
}
