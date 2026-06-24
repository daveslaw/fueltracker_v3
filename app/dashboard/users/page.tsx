import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getUserStatus } from '@/lib/user-management'
import { UserRow } from './UserRow'
import { CreateStationUserForm } from './CreateStationUserForm'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import Link from 'next/link'

export default async function UsersPage() {
  const [admin, supabase] = [createAdminClient(), await createClient()]

  const [{ data: profiles }, { data: stations }] = await Promise.all([
    admin.from('user_profiles').select('id, user_id, role, station_id, is_active, email, full_name, pin_hash, pin_locked, username').order('created_at'),
    supabase.from('stations').select('id, name').order('name'),
  ])

  const stationList = stations ?? []

  const users = (profiles ?? []).map((profile) => ({
    ...profile,
    full_name: profile.full_name ?? '—',
    email: profile.email ?? '—',
    pin_hash: profile.pin_hash ?? null,
    pin_locked: profile.pin_locked ?? false,
    status: getUserStatus({ is_active: profile.is_active }),
    station_name: stationList.find((s) => s.id === profile.station_id)?.name ?? '—',
  }))

  const existingUsernames = (profiles ?? []).map((p) => p.username).filter(Boolean) as string[]

  // Station staff (supervisors + cashiers) grouped by station
  const stationStaff = users.filter((u) => u.role === 'supervisor' || u.role === 'cashier')
  const ownerUsers = users.filter((u) => u.role !== 'supervisor' && u.role !== 'cashier')

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <Breadcrumb>
        <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbPage>Users</BreadcrumbPage></BreadcrumbItem>
      </Breadcrumb>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">User Management</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Add staff member</h2>
        <CreateStationUserForm stations={stationList} existingUsernames={existingUsernames} />
      </section>

      {stationList.map((station) => {
        const stationUsers = stationStaff.filter((u) => u.station_id === station.id)
        if (stationUsers.length === 0) return null
        return (
          <section key={station.id} className="space-y-3">
            <h2 className="text-lg font-medium">{station.name}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4">Name / Username</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {stationUsers.map((user) => (
                    <UserRow key={user.id} user={user} stations={stationList} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {ownerUsers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Owners</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Name / Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>

              <tbody>
                {ownerUsers.map((user) => (
                  <UserRow key={user.id} user={user} stations={stationList} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Station tablet setup</h2>
        <p className="text-sm text-gray-500">
          Open this link on a tablet&apos;s browser to bind it to a station for PIN login.
        </p>
        <Link href="/setup" className="text-sm font-medium text-amber-600 hover:underline">
          Go to device setup →
        </Link>
      </section>
    </main>
  )
}
