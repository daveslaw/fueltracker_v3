import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getUserStatus } from '@/lib/user-management'
import { UserRow } from './UserRow'
import { InviteForm } from './InviteForm'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import Link from 'next/link'

export default async function UsersPage() {
  const [admin, supabase] = [createAdminClient(), await createClient()]

  const [{ data: profiles }, { data: stations }] = await Promise.all([
    admin.from('user_profiles').select('id, user_id, role, station_id, is_active, email, full_name, pin_hash, pin_locked').order('created_at'),
    supabase.from('stations').select('id, name').order('name'),
  ])

  const users = (profiles ?? []).map((profile) => ({
    ...profile,
    full_name: profile.full_name ?? '—',
    email: profile.email ?? '—',
    pin_hash: profile.pin_hash ?? null,
    pin_locked: profile.pin_locked ?? false,
    status: getUserStatus({ is_active: profile.is_active }),
    station_name: stations?.find((s) => s.id === profile.station_id)?.name ?? '—',
  }))

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
        <h2 className="text-lg font-medium">Invite user</h2>
        <InviteForm stations={stations ?? []} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">All users ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Name / Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Station</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow key={user.id} user={user} stations={stations ?? []} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
