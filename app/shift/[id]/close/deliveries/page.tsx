import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getShiftDeliveries } from '@/lib/deliveries'
import { getCloseProgress } from '@/lib/shift-close'
import { buildShiftCloseSteps } from '@/lib/workflow-steps'
import { StepIndicator } from '@/components/StepIndicator'
import { deleteDelivery } from '../../../actions'
import { AddDeliveryForm } from './AddDeliveryForm'
import { HandoffPrompt } from '@/components/HandoffPrompt'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

const fmtL = (n: number) => `${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`

export default async function CloseDeliveriesPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, station_id, period, shift_date, status')
    .eq('id', shiftId)
    .single()
  if (!shift) notFound()
  if (shift.status !== 'pending') redirect(`/shift/${shiftId}/close/summary`)

  const [{ data: station }, { data: tanks }, deliveries, { data: pumps }, { data: closePumpReadings }, { data: closeDipReadings }] = await Promise.all([
    supabase.from('stations').select('name').eq('id', shift.station_id).single(),
    supabase.from('tanks').select('id, label, fuel_grade_id').eq('station_id', shift.station_id).order('label'),
    getShiftDeliveries(supabase, {
      stationId: shift.station_id,
      shiftDate: shift.shift_date,
      period: shift.period as 'morning' | 'evening',
    }),
    supabase.from('pumps').select('id').eq('station_id', shift.station_id),
    supabase.from('pump_readings').select('pump_id').eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('dip_readings').select('tank_id').eq('shift_id', shiftId).eq('type', 'close'),
  ])

  const progress = getCloseProgress(
    (pumps ?? []).map(p => p.id),
    (closePumpReadings ?? []).map(r => r.pump_id),
    (tanks ?? []).map(t => t.id),
    (closeDipReadings ?? []).map(r => r.tank_id),
    false,
    false,
  )
  const steps = buildShiftCloseSteps(shiftId, 'deliveries', progress)

  const tankLabel = (tankId: string) =>
    tanks?.find(t => t.id === tankId)?.label ?? tankId

  async function handleDelete(formData: FormData) {
    'use server'
    const deliveryId = formData.get('delivery_id') as string
    await deleteDelivery(deliveryId, shiftId)
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <StepIndicator steps={steps} currentIndex={2} />
      <div>
        <h1 className="text-xl font-semibold">Deliveries</h1>
        <p className="text-sm text-gray-500 capitalize mt-0.5">
          {station?.name} · {shift.period} · {shift.shift_date}
        </p>
      </div>

      {/* Recorded deliveries */}
      {deliveries.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Recorded ({deliveries.length})
          </h2>
          <div className="border rounded-md divide-y text-sm">
            {deliveries.map(d => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{tankLabel(d.tank_id)}</div>
                  <div className="text-gray-500 text-xs">{fmtL(d.litres_received)}</div>
                </div>
                <div className="flex items-center gap-3">
                  {d.delivery_note_url && (
                    <a
                      href={d.delivery_note_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 underline"
                    >
                      Receipt
                    </a>
                  )}
                  <form action={handleDelete}>
                    <input type="hidden" name="delivery_id" value={d.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-gray-400">No deliveries recorded for this shift.</p>
      )}

      {/* Add form */}
      <AddDeliveryForm shiftId={shiftId} tanks={tanks ?? []} />

      {/* Navigation */}
      <div className="flex gap-3">
        <Link
          href={`/shift/${shiftId}/close/dips`}
          className="flex-1 rounded border py-2 text-center text-sm font-medium"
        >
          Dip readings
        </Link>
        <Link
          href={`/shift/${shiftId}/close/summary`}
          className="flex-1 rounded bg-black py-2 text-center text-sm font-medium text-white"
        >
          Review &amp; submit
        </Link>
      </div>

      <HandoffPrompt
        message="Pass device to cashier."
        ctaLabel="Hand off to cashier"
      />
    </main>
  )
}
