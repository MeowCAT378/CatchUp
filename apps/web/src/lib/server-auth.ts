import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";

export type CurrentUser = {
  sub: string;
  email: string;
  role: "ADMIN" | "HOST" | "PLAYER";
};

export async function requireUser(role?: CurrentUser["role"]) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auth/me`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    },
  );
  if (!response.ok) redirect("/login");
  const body = (await response.json()) as { data: CurrentUser };
  if (role && body.data.role !== role)
    redirect(body.data.role === "ADMIN" ? "/admin" : "/teacher");
  return { token: session.accessToken, user: body.data };
}
