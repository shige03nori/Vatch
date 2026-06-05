'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

type Badges = { emails: number; matchings: number }

const NAV_SECTIONS = [
  {
    label: 'メイン',
    links: [
      { href: '/dashboard', label: 'ダッシュボード', icon: '▪', badgeKey: null },
      { href: '/emails',    label: 'メール取込',     icon: '✉',  badgeKey: 'emails',    badgeColor: 'amber' as const },
      { href: '/cases',     label: '案件管理',        icon: '📋', badgeKey: null },
      { href: '/talents',   label: '人材管理',        icon: '👤', badgeKey: null },
      { href: '/proper',    label: 'プロパ管理',      icon: '🏢', badgeKey: null },
    ],
  },
  {
    label: '営業',
    links: [
      { href: '/sales',     label: '営業管理',    icon: '💼', badgeKey: null },
      { href: '/matching',  label: 'マッチング',  icon: '⚡', badgeKey: 'matchings', badgeColor: 'blue' as const },
      { href: '/proposals', label: '提案メール',  icon: '📨', badgeKey: null },
      { href: '/progress',  label: '営業進捗',    icon: '📊', badgeKey: null },
    ],
  },
  {
    label: '管理',
    links: [
      { href: '/contracts', label: '契約・売上',   icon: '📝', badgeKey: null },
      { href: '/overview',  label: 'システム概要', icon: '🌐', badgeKey: null },
      { href: '/settings',  label: '設定',         icon: '⚙',  badgeKey: null },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [badges, setBadges] = useState<Badges>({ emails: 0, matchings: 0 })

  useEffect(() => {
    function fetchBadges() {
      fetch('/api/badges')
        .then((r) => r.json())
        .then((j) => { if (j.success) setBadges(j.data) })
        .catch(() => {})
    }
    fetchBadges()
    const id = setInterval(fetchBadges, 30_000)
    return () => clearInterval(id)
  }, [])

  const userName = session?.user?.name ?? '...'

  return (
    <aside className="w-[200px] flex-shrink-0 bg-vatch-surface border-r border-vatch-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-vatch-border">
        <Image src="/logo.png" alt="Vatch" width={32} height={32} className="flex-shrink-0" />
        <div>
          <div className="text-[17px] font-black text-amber-400 tracking-widest">VATCH</div>
          <div className="text-[8px] text-slate-600 tracking-wide">VICENT SES</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="px-2 py-1 mb-1">
            <div className="text-[9px] text-vatch-muted-dark uppercase tracking-widest px-2 mb-1">
              {section.label}
            </div>
            {section.links.map((link) => {
              const isActive = pathname === link.href
              const count = link.badgeKey ? badges[link.badgeKey as keyof Badges] : 0
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs mb-0.5 transition-colors ${
                    isActive
                      ? 'bg-[#0c2d5a] text-vatch-cyan font-semibold'
                      : 'text-vatch-muted hover:bg-vatch-border hover:text-vatch-text-dim'
                  }`}
                >
                  <span className="w-4 text-center text-[13px]">{link.icon}</span>
                  <span>{link.label}</span>
                  {link.badgeKey && count > 0 && (
                    <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      link.badgeColor === 'amber'
                        ? 'bg-amber-500 text-[#080f1e]'
                        : 'bg-sky-700 text-white'
                    }`}>
                      {count}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-vatch-border px-2 py-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-vatch-muted hover:bg-vatch-border cursor-pointer">
          <span className="w-4 text-center">👤</span>
          <span className="truncate">{userName}</span>
        </div>
      </div>
    </aside>
  )
}
