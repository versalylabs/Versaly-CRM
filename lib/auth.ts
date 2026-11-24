import type { NextAuthOptions } from 'next-auth'
import prisma from './prisma'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getPlatformAdminEmails } from './platformAdmin'
import { getAuthSecret } from './authSecret'

// Extend the default Session/JWT types to include role & organization
declare module 'next-auth' {
  interface User {
    role?: string
    organizationId?: string | null
    organizationName?: string | null
    plan?: string | null
    isPlatformAdmin?: boolean
  }

  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string
      organizationId?: string | null
      organizationName?: string | null
      plan?: string | null
      isPlatformAdmin?: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    id?: string
    organizationId?: string | null
    organizationName?: string | null
    plan?: string | null
    isPlatformAdmin?: boolean
  }
}

const rawNextAuthUrl = process.env.NEXTAUTH_URL;
if (
  !rawNextAuthUrl ||
  rawNextAuthUrl.includes('your-app-name') ||
  rawNextAuthUrl.includes('your-domain') ||
  rawNextAuthUrl.includes('example.com')
) {
  process.env.NEXTAUTH_URL = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://versaly-crm.vercel.app';
}

// No fallback secret: a missing secret must fail loudly (see lib/authSecret.ts).
const authSecret = getAuthSecret();

const DISABLED = '__disabled__'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email.trim().toLowerCase()

        const user = await prisma.user.findUnique({
          where: { email },
          include: { organization: true },
        })

        if (!user || !user.password || !user.isActive) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organization?.name || 'My Workspace',
          plan: user.organization?.plan || 'GROWTH_PRO',
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    // Keep authentication sessions reasonably short in production. Users can
    // sign in again when the session expires.
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    // Identity fields come only from the database at sign-in. Never copy them from a
    // client `update()` payload: platform-admin access is decided by email.
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.organizationId = user.organizationId
        token.organizationName = user.organizationName
        token.plan = user.plan
        token.isPlatformAdmin = getPlatformAdminEmails().includes((user.email || '').toLowerCase())
      } else if (token.id && token.id !== DISABLED) {
        // Re-read role, workspace and active status on every server-side session read, so a
        // deactivated user or a role/plan change takes effect immediately rather than after 8 hours.
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, role: true, organizationId: true, organization: { select: { name: true, plan: true } } },
        })
        if (!fresh || !fresh.isActive) {
          // Not a valid identity any more: ids that match nothing, no workspace, no admin rights.
          return { ...token, id: DISABLED, email: null, role: undefined, organizationId: null, isPlatformAdmin: false }
        }
        token.role = fresh.role
        token.organizationId = fresh.organizationId
        token.organizationName = fresh.organization?.name
        token.plan = fresh.organization?.plan
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        session.user.id = token.id as string
        session.user.organizationId = token.organizationId
        session.user.organizationName = token.organizationName
        session.user.plan = token.plan
        session.user.isPlatformAdmin = Boolean(
          token.isPlatformAdmin ||
          (session.user.email && getPlatformAdminEmails().includes(session.user.email.toLowerCase()))
        )
        if (token.name !== undefined) session.user.name = token.name
        if (token.email !== undefined) session.user.email = token.email
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  secret: authSecret,
  debug: process.env.NODE_ENV === 'development',
}

