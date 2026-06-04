// src/auth.config.ts
import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      if (!auth?.user) return false

      const role = (auth.user as { role?: string }).role

      if (role === 'PROPER' && !pathname.startsWith('/portal')) {
        return Response.redirect(new URL('/portal', request.url))
      }

      if (role !== 'PROPER' && pathname.startsWith('/portal')) {
        return Response.redirect(new URL('/dashboard', request.url))
      }

      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
