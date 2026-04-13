/**
 * shift-baselines — owner-set initial readings for a station's first shift.
 *
 * When the reconciliation runner finds no prior closed shift to use as the
 * opening baseline, it falls back to these values. Owners set them once during
 * station setup and can update them at any time.
 *
 * Architecture: port (interface) + Supabase adapter, same pattern as
 * reconciliation-runner. Inject the interface for unit tests.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BaselineRow = {
  station_id:   string
  pump_id:      string | null  // non-null for meter baselines
  tank_id:      string | null  // non-null for dip baselines
  reading_type: 'meter' | 'dip'
  value:        number
}

// ── Port ──────────────────────────────────────────────────────────────────────

export interface ShiftBaselinesRepository {
  /** Store or replace the opening meter reading for a pump at a station. */
  upsertPumpBaseline(stationId: string, pumpId: string, value: number): Promise<{ error?: string }>

  /** Store or replace the opening dip level for a tank at a station. */
  upsertTankBaseline(stationId: string, tankId: string, value: number): Promise<{ error?: string }>

  /** Return all baseline rows for a station (pumps + tanks). */
  getBaselines(stationId: string): Promise<BaselineRow[]>
}

// ── Supabase adapter ──────────────────────────────────────────────────────────

export function createSupabaseBaselinesRepository(db: SupabaseClient): ShiftBaselinesRepository {
  return {
    async upsertPumpBaseline(stationId, pumpId, value) {
      const { error } = await db.from('shift_baselines').upsert(
        {
          station_id:   stationId,
          pump_id:      pumpId,
          tank_id:      null,
          reading_type: 'meter',
          value,
          set_at:       new Date().toISOString(),
        },
        { onConflict: 'station_id,pump_id' }
      )
      return error ? { error: error.message } : {}
    },

    async upsertTankBaseline(stationId, tankId, value) {
      const { error } = await db.from('shift_baselines').upsert(
        {
          station_id:   stationId,
          pump_id:      null,
          tank_id:      tankId,
          reading_type: 'dip',
          value,
          set_at:       new Date().toISOString(),
        },
        { onConflict: 'station_id,tank_id' }
      )
      return error ? { error: error.message } : {}
    },

    async getBaselines(stationId) {
      const { data } = await db
        .from('shift_baselines')
        .select('station_id, pump_id, tank_id, reading_type, value')
        .eq('station_id', stationId)
      return (data ?? []) as BaselineRow[]
    },
  }
}
