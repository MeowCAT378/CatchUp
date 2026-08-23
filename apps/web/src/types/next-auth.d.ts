import "next-auth";
import type { DefaultSession } from "next-auth";
declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: DefaultSession["user"] & { role: string };
  }
  interface User {
    accessToken: string;
    role: string;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    role?: string;
  }
}
