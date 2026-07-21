import NextAuth from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import Credentials from "next-auth/providers/credentials";

const AZURE_AD_TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

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
  try {
    const body = new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    });

    const res = await fetch(AZURE_AD_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const refreshed = await res.json();
    if (!res.ok) throw refreshed;

    if (token.accountId) {
      const db = await getDb();
      await db.account.update({
        where: { id: token.accountId },
        data: {
          access_token: refreshed.access_token,
          expires_at: Math.floor(Date.now() / 1000 + refreshed.expires_in),
          refresh_token: refreshed.refresh_token ?? token.refresh_token,
        },
      });
    }

    return {
      ...token,
      access_token: refreshed.access_token,
      expires_at: Math.floor(Date.now() / 1000 + refreshed.expires_in),
      refresh_token: refreshed.refresh_token ?? token.refresh_token,
    };
  } catch (error) {
    console.error("Failed to refresh access token", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
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
        const { verifyPassword } = await import("@/lib/password");
        const { db } = await import("@/lib/db");
        const admin = await db.admin.findUnique({ where: { email: credentials.email as string } });
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
  pages: {
    signIn: "/auth/signin",
  },
});
