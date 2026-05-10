import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { prisma } from './prisma';
import { env } from './env';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    GitHub({
      clientId: env.githubId,
      clientSecret: env.githubSecret,
    }),
    Google({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    }),
  ],
  events: {
    // Auto-create a default "My Favorites" collection when a new user signs up.
    // Auth.js fires createUser only on the first OAuth sign-in (when the User
    // row is created), so duplicate default collections are not a risk.
    async createUser({ user }) {
      if (!user.id) return;
      await prisma.collection.create({
        data: {
          userId: user.id,
          name: 'My Favorites',
          isDefault: true,
        },
      });
    },
  },
});
