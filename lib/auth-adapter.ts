import { db } from "@/lib/db";
import type { Adapter, AdapterUser, AdapterAccount, AdapterSession } from "@auth/core/adapters";

export function AdminPrismaAdapter() {
  const p = db;
  return {
    async createUser(user: AdapterUser) {
      const name = user.name ?? user.email.split("@")[0];
      const initials = name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
      const admin = await p.admin.create({
        data: {
          name,
          email: user.email,
          emailVerified: user.emailVerified,
          initials,
          role: "admin",
          accountType: "unknown",
        },
      });
      return admin as unknown as AdapterUser;
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      return (await p.admin.findUnique({ where: { id } })) as unknown as AdapterUser | null;
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      return (await p.admin.findUnique({ where: { email } })) as unknown as AdapterUser | null;
    },

    async getUserByAccount(
      provider_providerAccountId: Pick<AdapterAccount, "provider" | "providerAccountId">
    ): Promise<AdapterUser | null> {
      const account = await p.account.findUnique({
        where: { provider_providerAccountId },
        include: { user: true },
      });
      return account?.user as unknown as AdapterUser | null;
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
      const { id, name, email, emailVerified } = user;
      const data: any = {};
      if (name != null) {
        data.name = name;
        data.initials = name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .toUpperCase();
      }
      if (email !== undefined) data.email = email;
      if (emailVerified !== undefined) data.emailVerified = emailVerified;
      const admin = await p.admin.update({
        where: { id },
        data,
      });
      return admin as unknown as AdapterUser;
    },

    async deleteUser(userId: string): Promise<AdapterUser | null | undefined> {
      return (await p.admin.delete({ where: { id: userId } })) as unknown as AdapterUser | null | undefined;
    },

    async linkAccount(account: AdapterAccount): Promise<AdapterAccount | null | undefined> {
      const created = await p.account.create({ data: account as any });
      return created as unknown as AdapterAccount;
    },

    async unlinkAccount(
      provider_providerAccountId: Pick<AdapterAccount, "provider" | "providerAccountId">
    ): Promise<AdapterAccount | undefined> {
      return (await p.account.delete({
        where: { provider_providerAccountId },
      })) as unknown as AdapterAccount | undefined;
    },

    async createSession(session: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }): Promise<AdapterSession> {
      return (await p.session.create({ data: session as any })) as unknown as AdapterSession;
    },

    async getSessionAndUser(
      sessionToken: string
    ): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const userAndSession = await p.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!userAndSession) return null;
      const { user, ...session } = userAndSession;
      return {
        session: session as unknown as AdapterSession,
        user: user as unknown as AdapterUser,
      };
    },

    async updateSession(
      session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">
    ): Promise<AdapterSession | null | undefined> {
      return (await p.session.update({
        where: { sessionToken: session.sessionToken },
        data: session as any,
      })) as unknown as AdapterSession | null | undefined;
    },

    async deleteSession(sessionToken: string): Promise<AdapterSession | null | undefined> {
      return (await p.session.delete({
        where: { sessionToken },
      })) as unknown as AdapterSession | null | undefined;
    },

    async getAccount(
      providerAccountId: string,
      provider: string
    ): Promise<AdapterAccount | null> {
      return (await p.account.findFirst({
        where: { providerAccountId, provider },
      })) as unknown as AdapterAccount | null;
    },
  } satisfies Adapter;
}
