import { UserButton } from '@clerk/nextjs'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <a href="/admin" className="font-semibold text-gray-700 hover:text-blue-600">Dashboard</a>
          <a href="/admin/testimonies" className="text-gray-600 hover:text-blue-600">Testimonies</a>
          <a href="/admin/settings" className="text-gray-600 hover:text-blue-600">Settings</a>
          <div className="ml-auto">
            <UserButton />
          </div>
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
