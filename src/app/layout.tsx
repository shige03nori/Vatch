import type { Metadata } from 'next'
import { Sidebar } from '@/components/layout/Sidebar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vatch — VICENT SES管理プラットフォーム',
  description: 'SES営業の提案活動を効率化するプラットフォーム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="flex h-screen overflow-hidden bg-vatch-bg text-vatch-text">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  )
}
