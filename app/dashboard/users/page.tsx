import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getUserStatus } from '@/lib/user-management'
import { UserRow } from './UserRow'
import { InviteForm } from './InviteForm'
import Link from 'next/link'

export default async function UsersPage() {
  const [admin, supabase] = [createAdminClient(), await createClient()]

  const [{ data: profiles }, { data: stations }] = await Promise.all([
    admin.from('user_profiles').select('id, user_id, role, station_id, is_active, email').order('created_at'),
    supabase.from('stations').select('id, name').order('name'),
  ])

  const users = (profiles ?? []).map((profile) => ({
    ...profile,
    email: profile.email ?? '—',
    status: getUserStatus({ is_active: profile.is_active }),
    station_name: stations?.find((s) => s.id === profile.station_id)?.name ?? '—',
  }))

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">
          ← Dashboard
        </Link>
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
                <th className="py-2 pr-4">Email</th>
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
