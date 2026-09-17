import NextAuth from 'next-auth'
import { authOptions } from '../../../../../lib/auth'

if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

const fallbackSecret = 'versaly-crm-session-production-auth-secret-key-32-chars-long-minimum';
if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = fallbackSecret;
}

const handler = NextAuth({
  ...authOptions,
  secret: process.env.NEXTAUTH_SECRET || fallbackSecret,
})

export { handler as GET, handler as POST }

