'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import clsx from 'clsx'

const NAV_LINKS = [
  { href: '/', label: 'ホーム' },
  { href: '/menu', label: 'メニュー' },
]

export default function Header() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50 border-b-4 border-secondary">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-black text-xl text-primary">
          <span>🍔</span>
          <span>JUNC</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'px-4 py-2 rounded-xl font-bold text-sm transition-colors',
                pathname === link.href
                  ? 'bg-primary-light text-primary'
                  : 'text-gray-600 hover:text-primary hover:bg-primary-light'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
              <button onClick={logout} className="btn-secondary text-sm px-4 py-2">
                ログアウト
              </button>
            </div>
          ) : (
            <Link href="/auth" className="btn-primary text-sm px-4 py-2">
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
