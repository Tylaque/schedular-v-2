import NextAuth from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import Credentials from "next-auth/providers/credentials";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { headers } from "next/headers";

const CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";

let _adapter: ReturnType<typeof import("@/lib/auth-adapter").AdminPrismaAdapter> | null = null;

async function getDb() {
  const { db } = await import("@/lib/db");
  return db;
}

async function getAdapter() {
  if (!_adapter) {
    const { AdminPrismaAdapter } = await import("@/lib/auth-adapter");
    _adapter = AdminPrismaAdapter();
  }
  return _adapter;
}

async function refreshAccessToken(token: any) {
  if (!token.accountId) return { ...token, error: "RefreshAccessTokenError" };

  const { refreshAzureToken } = await import("@/lib/graph/refresh");
  const updated = await refreshAzureToken(token.accountId);
  if (!updated) return { ...token, error: "RefreshAccessTokenError" };

  const db = await getDb();
  const account = await db.account.findUnique({ where: { id: token.accountId } });

  return {
    ...token,
    access_token: updated,
    expires_at: account?.expires_at ?? token.expires_at,
    refresh_token: account?.refresh_token ?? token.refresh_token,
    error: undefined,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: {
    async createUser(user) {
      const a = await getAdapter();
      return a.createUser(user);
    },
    async getUser(id) {
      const a = await getAdapter();
      return a.getUser(id);
    },
    async getUserByEmail(email) {
      const a = await getAdapter();
      return a.getUserByEmail(email);
    },
    async getUserByAccount(provider_providerAccountId) {
      const a = await getAdapter();
      return a.getUserByAccount(provider_providerAccountId);
    },
    async updateUser(user) {
      const a = await getAdapter();
      return a.updateUser(user);
    },
    async deleteUser(userId) {
      const a = await getAdapter();
      return a.deleteUser(userId);
    },
    async linkAccount(account) {
      const a = await getAdapter();
      return a.linkAccount(account);
    },
    async unlinkAccount(provider_providerAccountId) {
      const a = await getAdapter();
      return a.unlinkAccount(provider_providerAccountId);
    },
    async createSession(session) {
      const a = await getAdapter();
      return a.createSession(session);
    },
    async getSessionAndUser(sessionToken) {
      const a = await getAdapter();
      return a.getSessionAndUser(sessionToken);
    },
    async updateSession(session) {
      const a = await getAdapter();
      return a.updateSession(session);
    },
    async deleteSession(sessionToken) {
      const a = await getAdapter();
      return a.deleteSession(sessionToken);
    },
    async getAccount(providerAccountId, provider) {
      const a = await getAdapter();
      return a.getAccount(providerAccountId, provider);
    },
  },
  providers: [
    AzureAD({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid profile email offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/OnlineMeetings.ReadWrite",
        },
      },
      // Deliberate tradeoff: Microsoft-verified emails only — Azure AD
      // guarantees email ownership via the authenticated tid/oid claims,
      // so linking an existing password-setup-created Admin row to this
      // OAuth account on matching email is safe. This is NOT the same as
      // allowing arbitrary unverified-provider linking (which we DO NOT
      // enable elsewhere).
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate-limit sign-in attempts: 10 per email+IP per 15 minutes.
        // Generous enough to avoid locking out real users who mistype,
        // strict enough to slow brute-force attacks.
        const hdrs = await headers();
        const ip = getClientIp(hdrs);
        const email = (credentials.email as string).toLowerCase().trim();
        if (!checkRateLimit(`signin:${email}:${ip}`, 10, 15 * 60 * 1000)) {
          return null;
        }

        const { verifyPassword } = await import("@/lib/password");
        const { db } = await import("@/lib/db");
        const admin = await db.admin.findUnique({ where: { email } });
        if (!admin || !admin.passwordHash) return null;
        const valid = await verifyPassword(credentials.password as string, admin.passwordHash);
        if (!valid) return null;
        return { id: admin.id, name: admin.name, email: admin.email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
        token.accountId = account.id;

        if (profile) {
          const tid = (profile as any).tid;
          const accountType = tid === CONSUMER_TENANT ? "personal" : "organizational";

          if (token.sub) {
            const db = await getDb();
            await db.admin.update({
              where: { id: token.sub },
              data: { accountType: accountType as any },
            });
            token.accountType = accountType;
          }
        }
      }

      if (!token.role && token.sub) {
        const db = await getDb();
        const admin = await db.admin.findUnique({
          where: { id: token.sub },
          select: { role: true },
        });
        if (admin) {
          token.role = admin.role;
        }
      }

      if (token.expires_at && Date.now() / 1000 > (token.expires_at as number)) {
        token = await refreshAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as any).accountType = token.accountType ?? "unknown";
        (session.user as any).role = token.role ?? "admin";
      }
      return session;
    },
  },
  trustHost: true,
  pages: {
    signIn: "/auth/signin",
  },
});
