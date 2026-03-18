// src/lib/auth.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // PrismaAdapter はOAuth用テーブル管理に使用。
  // Credentials + jwt strategy の組み合わせでは Session テーブルへの書き込みは行われないが、
  // Phase 3 で OAuth プロバイダーを追加する際に adapter がそのまま機能する。
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (typeof credentials?.email !== 'string' || typeof credentials?.password !== 'string') {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        // Phase 2ではパスワード検証なし（シードで固定ユーザー利用）
        // Phase 3でbcryptjs導入予定
        return user;
      },
    }),
  ],
  // Credentials provider には jwt strategy が必須（database strategy 不可）
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.role) {
        session.user.role = token.role as import('@prisma/client').Role;
      }
      return session;
    },
  },
});
