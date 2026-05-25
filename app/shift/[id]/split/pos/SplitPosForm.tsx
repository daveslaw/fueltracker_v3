'use client'

import { NozzlePosForm, type PumpWithGrade, type GradePrice } from '@/components/NozzlePosForm'
import { savePosSubmission } from '@/app/shift/actions'

type Props = {
  shiftId: string
  pumps: PumpWithGrade[]
  prices: GradePrice[]
  existingLines: { pump_id: string; litres_sold: string; revenue_zar: string }[]
  existingPhotoUrl: string | null
}

export function SplitPosForm({ shiftId, pumps, prices, existingLines, existingPhotoUrl }: Props) {
  return (
    <NozzlePosForm
      shiftId={shiftId}
      pumps={pumps}
      prices={prices}
      existingLines={existingLines}
      existingPhotoUrl={existingPhotoUrl}
      onSave={savePosSubmission}
      uploadPath={`split-z-${shiftId}.jpg`}
    />
  )
}
