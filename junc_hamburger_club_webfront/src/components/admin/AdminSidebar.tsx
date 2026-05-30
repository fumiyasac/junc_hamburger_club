'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import clsx from 'clsx'

const NAV = [
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: '📊' },
  { href: '/admin/orders',    label: '注文管理',       icon: '📋' },
  { href: '/admin/burgers',   label: 'バーガー管理',   icon: '🍔' },
  { href: '/admin/users',     label: 'ユーザー管理',   icon: '👥' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const { logout } = useAdminAuth()
  const router = useRouter()

  function handleLogout() {
    logout()
    router.push('/admin/login')
  }

  return (
    <aside className="w-56 bg-gray-900 text-white min-h-screen flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 font-black text-lg">
          <span>🍔</span>
          <span>JUNC Admin</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>🚪</span>
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
  )
}
