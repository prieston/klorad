import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/auth/signin" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = nextUrl.pathname.startsWith("/org");
      if (isProtected) return isLoggedIn;
      return true;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = (token.id || token.sub) as string;
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
