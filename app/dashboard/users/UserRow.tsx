'use client'

import { useState } from 'react'
import { updateUserProfile, setUserActive, setUserPin, unlockUserPin } from './actions'
import { INVITABLE_ROLES, type UserStatus } from '@/lib/user-management'

type Station = { id: string; name: string }
type User = {
  id: string
  full_name: string
  email: string
  role: string
  station_id: string | null
  station_name: string
  status: UserStatus
  is_active: boolean
  pin_hash: string | null
  pin_locked: boolean
  username?: string | null
}

const STATUS_BADGE: Record<UserStatus, string> = {
  active:   'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-500',
}

export function UserRow({ user, stations }: { user: User; stations: Station[] }) {
  const [editing, setEditing] = useState(false)
  const [settingPin, setSettingPin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await updateUserProfile(user.id, new FormData(e.currentTarget))
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setEditing(false)
  }

  async function handleSetPin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await setUserPin(user.id, new FormData(e.currentTarget))
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setSettingPin(false)
  }

  async function handleUnlock() {
    setPending(true)
    await unlockUserPin(user.id)
    setPending(false)
  }

  async function toggleActive() {
    setPending(true)
    await setUserActive(user.id, !user.is_active)
    setPending(false)
  }

  return (
    <>
      <tr className="border-b">
        <td className="py-2 pr-4">
          <div className="font-medium text-sm">{user.full_name}</div>
          <div className="font-mono text-xs text-gray-400">{user.username ?? user.email}</div>
        </td>
        <td className="py-2 pr-4 capitalize">{user.role}</td>
        <td className="py-2 pr-4">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[user.status]}`}>
            {user.status}
          </span>
          {user.pin_locked && (
            <span className="ml-1 rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
              PIN locked
            </span>
          )}
          {user.pin_hash && !user.pin_locked && (
            <span className="ml-1 rounded px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600">
              PIN set
            </span>
          )}
        </td>
        <td className="py-2 flex flex-wrap gap-2">
          <button onClick={() => { setEditing(!editing); setSettingPin(false) }}
            className="text-xs text-blue-600 hover:underline">
            Edit
          </button>
          <button onClick={() => { setSettingPin(!settingPin); setEditing(false) }}
            className="text-xs text-blue-600 hover:underline">
            Reset PIN
          </button>
          {user.pin_locked && (
            <button onClick={handleUnlock} disabled={pending}
              className="text-xs text-orange-600 hover:underline disabled:opacity-50">
              Unlock
            </button>
          )}
          <button onClick={toggleActive} disabled={pending}
            className="text-xs text-gray-500 hover:underline disabled:opacity-50">
            {user.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </td>
      </tr>

      {editing && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="py-3 px-4">
            <form onSubmit={handleUpdate} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">Role</label>
                <select name="role" defaultValue={user.role}
                  className="rounded border px-2 py-1 text-sm">
                  {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Station</label>
                <select name="station_id" defaultValue={user.station_id ?? ''}
                  className="rounded border px-2 py-1 text-sm">
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                {pending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="text-xs text-gray-500 hover:underline">
                Cancel
              </button>
              {error && <p className="w-full text-xs text-red-600">{error}</p>}
            </form>
          </td>
        </tr>
      )}

      {settingPin && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="py-3 px-4">
            <form onSubmit={handleSetPin} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">New PIN</label>
                <input name="pin" type="password" inputMode="numeric" maxLength={4}
                  placeholder="4 digits" required
                  className="rounded border px-2 py-1 text-sm w-24" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Confirm PIN</label>
                <input name="pin_confirm" type="password" inputMode="numeric" maxLength={4}
                  placeholder="4 digits" required
                  className="rounded border px-2 py-1 text-sm w-24" />
              </div>
              <button type="submit" disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                {pending ? 'Saving…' : 'Save PIN'}
              </button>
              <button type="button" onClick={() => setSettingPin(false)}
                className="text-xs text-gray-500 hover:underline">
                Cancel
              </button>
              {error && <p className="w-full text-xs text-red-600">{error}</p>}
            </form>
          </td>
        </tr>
      )}
    </>
  )
}
