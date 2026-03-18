// src/auth.config.ts
// Edge Runtime セーフな NextAuth 設定（Prisma などの Node.js 依存を含まない）
import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth }) {
      // セッションが存在すれば認証済み
      return !!auth?.user
    },
  },
  providers: [],
} satisfies NextAuthConfig
