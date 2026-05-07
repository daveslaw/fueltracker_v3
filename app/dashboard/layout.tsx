import { DashboardNav } from './_components/DashboardNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardNav />
      {/* pt-14 clears the fixed mobile top bar; desktop nav is in normal flow */}
      <div className="pt-14 md:pt-0">
        {children}
      </div>
    </>
  )
}
