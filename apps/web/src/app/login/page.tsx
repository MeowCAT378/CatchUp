"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { UserIcon } from "@heroicons/react/24/outline";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(form: FormData) {
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email: form.get("email"),
        password: form.get("password"),
        redirect: false,
      });
      if (result?.error) setError(t("auth.invalidCredentials"));
      else router.replace("/teacher");
    } catch {
      setError(t("errors.REQUEST_FAILED"));
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="page-shell">
      <section className="page-content flex min-h-screen max-w-md flex-col justify-center">
        <BackButton href="/" />
        <div className="panel mt-4 w-full">
          <Logo className="mx-auto h-28 w-auto sm:h-32" />
          <h1 className="mt-4 text-3xl font-black text-slate-900">
            {t("auth.signIn")}
          </h1>
          <form action={submit} className="mt-7 grid gap-4">
            <label className="font-medium">
              {t("auth.email")}
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="form-input"
              />
            </label>
            <label className="font-medium">
              {t("auth.password")}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="form-input"
              />
            </label>
            <button disabled={loading} className="btn-primary">
              <UserIcon className="h-5 w-5" aria-hidden="true" />
              {loading ? t("common.loading") : t("auth.signIn")}
            </button>
            {error && (
              <p role="alert" className="alert-error">
                {error}
              </p>
            )}
          </form>
          <a
            className="mt-5 block font-semibold text-sky-700 hover:text-sky-800"
            href="/register"
          >
            {t("auth.register")}
          </a>
        </div>
      </section>
    </main>
  );
}
