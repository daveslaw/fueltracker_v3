const STORAGE_KEY = 'fueltracker_station_id'

export function getStationId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStationId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // localStorage unavailable (e.g. private browsing) — silent no-op
  }
}
