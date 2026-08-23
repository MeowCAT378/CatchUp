import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return Response.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sign in required" },
      },
      { status: 401 },
    );
  const source = new URL(request.url);
  const path = (await params).path.map(encodeURIComponent).join("/");
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/${path}${source.search}`,
    {
      method: request.method,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(request.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type")! }
          : {}),
      },
      body:
        request.method === "PATCH" ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    },
  );
  const headers = new Headers();
  for (const name of ["content-type", "content-disposition"])
    if (response.headers.has(name))
      headers.set(name, response.headers.get(name)!);
  return new Response(response.body, { status: response.status, headers });
}

export const GET = proxy;
export const PATCH = proxy;
