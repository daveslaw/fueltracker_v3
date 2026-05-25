import type { DeliveryReportRow } from './delivery-report'

export interface DailyReconciliationPumpRow {
  date:                 string
  period:               string
  pump_label:           string
  fuel_grade:           string
  meter_delta_litres:   number
  pos_litres_sold:      number
  variance_litres:      number
  pos_revenue_zar:      number
  expected_revenue_zar: number
  variance_zar:         number
}

/** Generates a CSV-safe filename: `{station_slug}_{type}_{dateRange}.csv` */
export function buildCsvFilename(
  reportType: string,
  stationName: string,
  dateRange: string,
): string {
  const slug = stationName.toLowerCase().replace(/\s+/g, '_')
  return `${slug}_${reportType}_${dateRange}.csv`
}

/** Serialises headers + rows into RFC 4180 CSV. Values containing commas or quotes are quoted. */
export function reportRowsToCsv(
  headers: string[],
  rows: (string | number)[][],
): string {
  const escape = (v: string | number): string => {
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  const lines = [headers, ...rows].map(row => row.map(escape).join(','))
  return lines.join('\n')
}

/** Serialises per-pump reconciliation lines to RFC 4180 CSV (one row per pump). */
export function formatDailyReconciliationCsv(rows: DailyReconciliationPumpRow[]): string {
  const headers = [
    'Date', 'Period', 'Pump', 'Grade',
    'Meter Delta (L)', 'POS Litres', 'Variance (L)',
    'POS Revenue (ZAR)', 'Expected Revenue (ZAR)', 'Variance (ZAR)',
  ]
  const data = rows.map(r => [
    r.date,
    r.period,
    r.pump_label,
    r.fuel_grade,
    r.meter_delta_litres,
    r.pos_litres_sold,
    r.variance_litres,
    r.pos_revenue_zar,
    r.expected_revenue_zar,
    r.variance_zar,
  ] as (string | number)[])
  return reportRowsToCsv(headers, data)
}

/** Serialises delivery report rows to RFC 4180 CSV. */
export function formatDeliveriesCSV(rows: DeliveryReportRow[]): string {
  const headers = [
    'Date & Time', 'Station', 'Tank', 'Grade', 'Litres Received',
    'Delivery Note #', 'Driver', 'Recorded By', 'Photo URL',
  ]
  const data = rows.map(r => [
    r.deliveredAt,
    r.stationName,
    r.tankLabel,
    r.fuelGrade,
    r.litresReceived,
    r.deliveryNoteNumber,
    r.driverName,
    r.recordedByName,
    r.deliveryNoteUrl ?? '',
  ] as (string | number)[])
  return reportRowsToCsv(headers, data)
}
