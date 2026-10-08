import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { auth, enabledSocialProviders } from "@/lib/auth";

export const metadata = { title: "Sign in · CrackQuick" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const raw = typeof next === "string" ? next : "";
  // Only same-site paths, so the link can't bounce someone to another site after signing in.
  const target = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  if (await auth.api.getSession({ headers: await headers() })) redirect(target);
  return <LoginForm next={target} providers={enabledSocialProviders} />;
}
