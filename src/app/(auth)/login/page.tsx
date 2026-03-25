'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Errors = {
  email?: string
  password?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // クライアントサイドバリデーション
    const newErrors: Errors = {}
    if (!email) newErrors.email = 'メールアドレスを入力してください'
    if (!password) newErrors.password = 'パスワードを入力してください'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (!result?.ok) {
        setErrors({ password: 'メールアドレスまたはパスワードが正しくありません' })
      } else {
        router.push('/dashboard')
      }
    } catch {
      setErrors({ password: 'メールアドレスまたはパスワードが正しくありません' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-vatch-bg flex items-center justify-center px-4">
      {/* グリッド背景 */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#0f2444 1px, transparent 1px), linear-gradient(90deg, #0f2444 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.35,
        }}
      />
      {/* シアングロー */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(56,189,248,0.04) 0%, transparent 70%)',
        }}
      />

      {/* ロゴ + カード */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* ロゴ（カード枠線の上） */}
        <div className="text-center mb-5">
          <div className="text-[26px] font-black text-vatch-amber tracking-[8px]">VATCH</div>
          <div className="text-[9px] text-vatch-muted-dark tracking-[3px] mt-1">VICENT SES</div>
        </div>

        {/* カード */}
        <div
          className="w-full rounded-xl border border-vatch-border p-9"
          style={{
            background: 'rgba(8,15,30,0.92)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.05)',
          }}
        >
          <h1 className="text-xl font-bold text-vatch-text-bright text-center mb-1">ログイン</h1>
          <p className="text-xs text-vatch-muted text-center mb-7">Vatch アカウントにサインイン</p>

          <form onSubmit={handleSubmit} noValidate>
            {/* メールアドレス */}
            <div className="mb-5">
              <label className="block text-[11px] text-vatch-text-dim mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yamada@vicent.co.jp"
                className={`w-full bg-[#0c1a2e] border rounded-md px-3.5 py-2.5 text-sm text-vatch-text outline-none transition-colors ${
                  errors.email
                    ? 'border-vatch-red focus:border-vatch-red'
                    : 'border-vatch-border focus:border-vatch-cyan'
                }`}
              />
              {errors.email && (
                <p className="mt-1.5 text-[10px] text-vatch-red flex items-center gap-1">
                  <span aria-hidden="true">⚠</span>
                  <span>{errors.email}</span>
                </p>
              )}
            </div>

            {/* パスワード */}
            <div className="mb-6">
              <label className="block text-[11px] text-vatch-text-dim mb-1.5">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full bg-[#0c1a2e] border rounded-md px-3.5 py-2.5 text-sm text-vatch-text outline-none transition-colors ${
                  errors.password
                    ? 'border-vatch-red focus:border-vatch-red'
                    : 'border-vatch-border focus:border-vatch-cyan'
                }`}
              />
              {errors.password && (
                <p className="mt-1.5 text-[10px] text-vatch-red flex items-center gap-1">
                  <span aria-hidden="true">⚠</span>
                  <span>{errors.password}</span>
                </p>
              )}
            </div>

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md py-2.5 text-sm font-bold text-white tracking-wide transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(90deg, #0284c7, #38bdf8)' }}
            >
              {isLoading ? 'ログイン中...' : 'ログイン →'}
            </button>
          </form>

          {/* パスワードを忘れた場合 */}
          <p className="text-center mt-4 text-[11px] text-vatch-muted">
            <a href="#" className="text-vatch-cyan opacity-70 hover:opacity-100 transition-opacity">
              パスワードをお忘れですか？
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
