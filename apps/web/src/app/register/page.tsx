"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import { BackButton } from "@/components/back-button";
import { api, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(form: FormData) {
    setLoading(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      await signIn("credentials", {
        email: form.get("email"),
        password: form.get("password"),
        redirect: false,
      });
      router.push("/teacher");
    } catch (e) {
      setError(
        t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`),
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="page-shell">
      <section className="page-content flex min-h-screen max-w-md flex-col justify-center">
        <BackButton href="/login" />
        <div className="panel mt-4 w-full">
          <p className="badge">CatchUp</p>
          <h1 className="mt-4 text-3xl font-black text-slate-900">
            {t("auth.register")}
          </h1>
          <form action={submit} className="mt-7 grid gap-4">
            <label className="font-medium">
              {t("auth.name")}
              <input name="name" required className="form-input" />
            </label>
            <label className="font-medium">
              {t("auth.email")}
              <input
                name="email"
                type="email"
                required
                className="form-input"
              />
            </label>
            <label className="font-medium">
              {t("auth.password")}
              <input
                name="password"
                type="password"
                minLength={8}
                required
                className="form-input"
              />
            </label>
            <button disabled={loading} className="btn-primary">
              <UserPlusIcon className="h-5 w-5" aria-hidden="true" />
              {loading ? t("common.loading") : t("auth.createAccount")}
            </button>
            {error && (
              <p role="alert" className="alert-error">
                {error}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
