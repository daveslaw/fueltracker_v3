import { StationForm } from '../StationForm'

export default function NewStationPage() {
  return (
    <main className="p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Add Station</h1>
      <StationForm />
    </main>
  )
}
