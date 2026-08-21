import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import ResultsClient from "./results-client";
export default async function ResultsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <ResultsClient token={session.accessToken} code={(await params).code} />
  );
}
