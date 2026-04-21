import { signOut } from '@/app/(auth)/login/actions'

export default function ShiftLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b">
        <div className="max-w-lg mx-auto px-6 py-3 flex justify-end">
          <form action={signOut}>
            <button type="submit"
              className="rounded border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Log out
            </button>
          </form>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
