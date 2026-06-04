// src/lib/auth.ts
import NextAuth from 'next-auth';
import type { Role } from '@prisma/client';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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

        // password が未設定（null）のユーザーはCredentials認証をスキップ。
        // 現在はシードユーザー（ADMIN/STAFF）がこれに該当し、auto-loginページ経由で使用される。
        // PROPER ユーザーは必ずパスワードが設定されるため、このパスを通らない。
        if (user.password) {
          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) return null;
        }
        return user;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role as Role;
      return session;
    },
  },
});
