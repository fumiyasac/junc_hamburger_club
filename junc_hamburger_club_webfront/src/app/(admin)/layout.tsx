import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'JUNC Admin',
  description: 'JUNC Hamburger Club 管理画面',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
