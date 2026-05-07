import type { DeliveryReportRow } from './delivery-report'

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
