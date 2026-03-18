'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navSections = [
  {
    label: 'メイン',
    links: [
      { href: '/dashboard', label: 'ダッシュボード', icon: '▪' },
      { href: '/emails',    label: 'メール取込',     icon: '✉',  badge: 8,  badgeColor: 'amber' as const },
      { href: '/cases',     label: '案件管理',        icon: '📋' },
      { href: '/talents',   label: '人材管理',        icon: '👤' },
    ],
  },
  {
    label: '営業',
    links: [
      { href: '/matching',  label: 'マッチング',  icon: '⚡', badge: 5, badgeColor: 'blue' as const },
      { href: '/proposals', label: '提案メール',  icon: '📨' },
      { href: '/progress',  label: '営業進捗',    icon: '📊' },
    ],
  },
  {
    label: '管理',
    links: [
      { href: '/contracts', label: '契約・売上', icon: '📝' },
      { href: '/settings',  label: '設定',        icon: '⚙' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

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
        {navSections.map((section) => (
          <div key={section.label} className="px-2 py-1 mb-1">
            <div className="text-[9px] text-vatch-muted-dark uppercase tracking-widest px-2 mb-1">
              {section.label}
            </div>
            {section.links.map((link) => {
              const isActive = pathname === link.href
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
                  {'badge' in link && link.badge && (
                    <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      link.badgeColor === 'amber'
                        ? 'bg-amber-500 text-[#080f1e]'
                        : 'bg-sky-700 text-white'
                    }`}>
                      {link.badge}
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
          <span>山田 太郎</span>
        </div>
      </div>
    </aside>
  )
}
