"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowRightIcon, UsersIcon } from "@heroicons/react/24/outline";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";
import { api, ApiError } from "@/lib/api";
import { saveParticipant } from "@/lib/participant";

export default function JoinPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const initialCode = (
      new URLSearchParams(window.location.search).get("code") ?? ""
    )
      .replace(/\D/g, "")
      .slice(0, 6);
    queueMicrotask(() => setCode(initialCode));
  }, []);
  async function submit() {
    const name = displayName.trim();
    if (name.length < 2 || name.length > 40) {
      setError(t("errors.VALIDATION_ERROR"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const joined = await api<{
        participantId: string;
        participantToken: string;
        roomCode: string;
      }>("/rooms/join", {
        method: "POST",
        body: JSON.stringify({ code, displayName: name }),
      });
      saveParticipant(joined.roomCode, {
        id: joined.participantId,
        token: joined.participantToken,
      });
      router.push(`/play/${joined.roomCode}`);
    } catch (e) {
      setError(
        t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`),
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="page-shell page-shell-join">
      <section className="page-content flex min-h-screen max-w-md flex-col justify-center">
        <BackButton href="/" />
        <div className="panel mt-4 w-full">
          <Logo className="mx-auto h-28 w-auto sm:h-32" />
          <h1 className="mt-4 text-3xl font-black text-slate-900">
            {t("player.joinRoom")}
          </h1>
          <form action={submit} className="mt-7 grid gap-4">
            <label className="font-medium">
              {t("common.roomCode")}
              <input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                className="form-input"
              />
            </label>
            <label className="font-medium">
              {t("player.displayName")}
              <input
                name="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
                minLength={2}
                maxLength={40}
                autoComplete="name"
                aria-describedby="display-name-hint"
                required
                className="form-input"
              />
            </label>
            <p id="display-name-hint" className="-mt-2 text-sm text-slate-600">
              {t("player.joinHint")}
            </p>
            <button disabled={loading} className="btn-primary">
              <UsersIcon className="h-5 w-5" aria-hidden="true" />
              {loading ? t("common.loading") : t("room.join")}
              <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
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
