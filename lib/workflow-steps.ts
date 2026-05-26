import type { Step, StepStatus } from '@/components/StepIndicator'
import type { CloseProgress } from '@/lib/shift-close'
import type { CashierProgress } from '@/lib/cashier-progress'

type ShiftClosePage = 'pumps' | 'dips' | 'deliveries' | 'summary'
type CashierPage = 'fuel-pos' | 'stock-pos' | 'stock-count' | 'summary'

function statusFor(page: string, current: string, isComplete: boolean): StepStatus {
  if (page === current) return 'current'
  return isComplete ? 'complete' : 'upcoming'
}

export function buildShiftCloseSteps(
  shiftId: string,
  current: ShiftClosePage,
  progress: CloseProgress,
): Step[] {
  const pumpsComplete = progress.pumps.done === progress.pumps.total && progress.pumps.total > 0
  const dipsComplete = progress.tanks.done === progress.tanks.total && progress.tanks.total > 0

  return [
    { label: 'Pumps',      href: `/shift/${shiftId}/close/pumps`,      status: statusFor('pumps',      current, pumpsComplete) },
    { label: 'Dips',       href: `/shift/${shiftId}/close/dips`,       status: statusFor('dips',       current, dipsComplete) },
    { label: 'Deliveries', href: `/shift/${shiftId}/close/deliveries`, status: statusFor('deliveries', current, true) },
    { label: 'Summary',    href: `/shift/${shiftId}/close/summary`,    status: statusFor('summary',    current, true) },
  ]
}

export function buildCashierSteps(
  shiftId: string,
  current: CashierPage,
  progress: CashierProgress,
): Step[] {
  return [
    { label: 'Fuel POS',    href: `/cashier/${shiftId}/fuel-pos`,    status: statusFor('fuel-pos',    current, progress.fuelPos) },
    { label: 'Stock POS',   href: `/cashier/${shiftId}/stock-pos`,   status: statusFor('stock-pos',   current, true) },
    { label: 'Stock Count', href: `/cashier/${shiftId}/stock-count`, status: statusFor('stock-count', current, true) },
    { label: 'Summary',     href: `/cashier/${shiftId}/summary`,     status: statusFor('summary',     current, true) },
  ]
}
