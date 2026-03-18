import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vatch — VICENT SES管理プラットフォーム',
  description: 'SES営業の提案活動を効率化するプラットフォーム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-vatch-bg text-vatch-text">
        {children}
      </body>
    </html>
  )
}
