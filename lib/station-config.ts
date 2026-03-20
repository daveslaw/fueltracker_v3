export const FUEL_GRADE_IDS = ['95', '93', 'D10', 'D50'] as const
export type FuelGradeId = typeof FUEL_GRADE_IDS[number]

// ── Types ────────────────────────────────────────────────────────────────────

export type StationRow = { id: string; name: string; address: string | null }
export type TankRow = { id: string; station_id: string; label: string; fuel_grade_id: string; capacity_litres: number }
export type PumpRow = { id: string; station_id: string; tank_id: string; label: string }

export type PumpNode = PumpRow
export type TankNode = TankRow & { pumps: PumpNode[] }
export type StationNode = StationRow & { tanks: TankNode[] }

// ── buildStationTree ─────────────────────────────────────────────────────────

export function buildStationTree(
  stations: StationRow[],
  tanks: TankRow[],
  pumps: PumpRow[]
): StationNode[] {
  return stations.map((station) => {
    const stationTanks = tanks
      .filter((t) => t.station_id === station.id)
      .map((tank) => ({
        ...tank,
        pumps: pumps.filter((p) => p.tank_id === tank.id),
      }))
    return { ...station, tanks: stationTanks }
  })
}

// ── validateStation ──────────────────────────────────────────────────────────

export function validateStation(input: { name: string }): string | null {
  if (!input.name.trim()) return 'Station name is required'
  return null
}

// ── validateTank ─────────────────────────────────────────────────────────────

export function validateTank(input: {
  label: string
  fuel_grade_id: string
  capacity_litres: number
}): string | null {
  if (!input.label.trim()) return 'Tank label is required'
  if (!(FUEL_GRADE_IDS as readonly string[]).includes(input.fuel_grade_id))
    return `Invalid fuel grade — must be one of ${FUEL_GRADE_IDS.join(', ')}`
  if (input.capacity_litres <= 0) return 'Tank capacity must be greater than 0'
  return null
}

// ── validatePump ─────────────────────────────────────────────────────────────

export function validatePump(input: { label: string; tank_id: string }): string | null {
  if (!input.label.trim()) return 'Pump label is required'
  if (!input.tank_id) return 'A tank must be selected for this pump'
  return null
}
