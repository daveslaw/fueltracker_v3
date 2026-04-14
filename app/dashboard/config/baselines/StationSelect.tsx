'use client'

interface Props {
  stations: { id: string; name: string }[]
  selectedStation: string
}

export function StationSelect({ stations, selectedStation }: Props) {
  return (
    <form method="GET" className="flex gap-3 items-center">
      <select
        name="station"
        defaultValue={selectedStation}
        onChange={e => e.currentTarget.form?.submit()}
        className="rounded border px-3 py-2 text-sm"
      >
        {stations.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="rounded border px-3 py-2 text-sm">Select</button>
      </noscript>
    </form>
  )
}
