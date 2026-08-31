"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiErrorCode, secureApi, type ApiErrorCode } from "@/lib/api";
import { SkeletonTable } from "@/components/skeleton";
import { Select, type SelectOption } from "@/components/select";
import { Dialog } from "@/components/dialog";
import { PasswordInput } from "@/components/password-input";

type Teacher = {
  id: string;
  name: string | null;
  email: string;
  role: "HOST" | "ADMIN";
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
  activityCount: number;
  sessionCount: number;
  lastActivityAt: string | null;
};
type Result = { items: Teacher[]; page: number; totalPages: number };

export function AdminTeachers() {
  const { t, i18n } = useTranslation();
  const [result, setResult] = useState<Result>();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loadedQuery, setLoadedQuery] = useState("");
  const [error, setError] = useState<ApiErrorCode | "">("");
  const [message, setMessage] = useState("");
  const [promoting, setPromoting] = useState<Teacher>();
  const [promotingId, setPromotingId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirmation, setCreateConfirmation] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const statusOptions: SelectOption[] = [
    { value: "", label: t("admin.allStatuses") },
    { value: "ACTIVE", label: t("admin.active") },
    { value: "DISABLED", label: t("admin.disabled") },
  ];
  const query = useMemo(() => {
    const value = new URLSearchParams({ page: String(page) });
    if (search) value.set("search", search);
    if (status) value.set("status", status);
    return value.toString();
  }, [page, search, status]);
  const loading = loadedQuery !== query;
  useEffect(() => {
    let active = true;
    secureApi<Result>(`/admin/teachers?${query}`)
      .then((value) => {
        if (!active) return;
        setResult(value);
        setError("");
      })
      .catch((value) => active && setError(apiErrorCode(value)))
      .finally(() => active && setLoadedQuery(query));
    return () => {
      active = false;
    };
  }, [query]);
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "—";
  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(input.trim());
  }
  async function promote() {
    if (!promoting || promotingId) return;
    setPromotingId(promoting.id);
    setError("");
    setMessage("");
    try {
      const updated = await secureApi<Pick<Teacher, "id" | "role">>(
        `/admin/users/${promoting.id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "ADMIN" }),
        },
      );
      setResult((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === updated.id ? { ...item, role: updated.role } : item,
              ),
            }
          : current,
      );
      setPromoting(undefined);
      setMessage(t("admin.roleChanged"));
    } catch (value) {
      setError(apiErrorCode(value));
    } finally {
      setPromotingId("");
    }
  }
  function closeCreate() {
    setCreating(false);
    setCreatePassword("");
    setCreateConfirmation("");
    setPasswordMismatch(false);
  }
  async function createUser(event: FormEvent) {
    event.preventDefault();
    if (createBusy) return;
    if (createPassword !== createConfirmation) {
      setPasswordMismatch(true);
      return;
    }
    setCreateBusy(true);
    setError("");
    setMessage("");
    try {
      await secureApi("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          password: createPassword,
        }),
      });
      setResult(await secureApi<Result>(`/admin/teachers?${query}`));
      setLoadedQuery(query);
      setCreateName("");
      setCreateEmail("");
      closeCreate();
      setMessage(t("admin.userCreated"));
    } catch (value) {
      setError(apiErrorCode(value));
    } finally {
      setCreateBusy(false);
    }
  }
  return (
    <main className="page-shell">
      <div className="page-content max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">{t("admin.teachers")}</h1>
          <button
            type="button"
            onClick={() => {
              setError("");
              setCreating(true);
            }}
            className="btn-primary"
          >
            {t("admin.createUser")}
          </button>
        </div>
        <form
          onSubmit={submit}
          className="filter-bar grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_180px]"
        >
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {t("admin.search")}
            </span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("admin.searchTeachers")}
              className="form-input mt-0 h-11 min-h-0"
            />
          </label>
          <div>
            <label
              id="admin-teacher-status-label"
              htmlFor="admin-teacher-status"
              className="mb-1.5 block text-xs font-medium text-slate-700"
            >
              {t("admin.status")}
            </label>
            <Select
              id="admin-teacher-status"
              labelId="admin-teacher-status-label"
              value={status}
              onValueChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
              options={statusOptions}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="block text-xs font-medium" aria-hidden="true">
              &nbsp;
            </span>
            <button type="submit" className="btn-primary h-11 min-h-0 w-full">
              {t("admin.search")}
            </button>
          </div>
        </form>
        {error && !creating && (
          <p className="alert-error mt-5" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        {message && (
          <p
            className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-800"
            role="status"
          >
            {message}
          </p>
        )}
        {loading && !result ? (
          <div aria-busy="true">
            <SkeletonTable columns={8} />
          </div>
        ) : result?.items.length ? (
          <div className="table-surface">
            <table className="data-table min-w-[36rem] sm:min-w-0">
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("admin.role")}</th>
                  <th>{t("admin.status")}</th>
                  <th className="hidden sm:table-cell">
                    {t("admin.activities")}
                  </th>
                  <th className="hidden sm:table-cell">
                    {t("admin.sessions")}
                  </th>
                  <th className="hidden lg:table-cell">{t("admin.dates")}</th>
                  <th className="hidden lg:table-cell">
                    {t("admin.lastActivity")}
                  </th>
                  <th>
                    <span className="sr-only">{t("admin.teacherDetails")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>
                      <strong>{teacher.name ?? "—"}</strong>
                      <div className="break-all text-sm text-slate-500">
                        {teacher.email}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${teacher.role === "ADMIN" ? "bg-cyan-50 text-cyan-900" : "bg-sky-50 text-sky-800"}`}
                      >
                        {t(
                          teacher.role === "ADMIN"
                            ? "admin.adminRole"
                            : "admin.teacherRole",
                        )}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${teacher.isDisabled ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                      >
                        {t(
                          teacher.isDisabled
                            ? "admin.disabled"
                            : "admin.active",
                        )}
                      </span>
                    </td>
                    <td className="hidden tabular-nums sm:table-cell">
                      {teacher.activityCount}
                    </td>
                    <td className="hidden tabular-nums sm:table-cell">
                      {teacher.sessionCount}
                    </td>
                    <td className="hidden text-sm lg:table-cell">
                      {date(teacher.createdAt)}
                      <br />
                      {date(teacher.updatedAt)}
                    </td>
                    <td className="hidden lg:table-cell">
                      {date(teacher.lastActivityAt)}
                    </td>
                    <td className="space-y-2 sm:space-x-2 sm:space-y-0">
                      {teacher.role === "HOST" && (
                        <button
                          type="button"
                          disabled={Boolean(promotingId)}
                          onClick={() => setPromoting(teacher)}
                          className="btn-primary px-3"
                        >
                          {promotingId === teacher.id
                            ? t("admin.promoting")
                            : t("admin.promoteToAdmin")}
                        </button>
                      )}
                      <a
                        className="btn-secondary px-3"
                        href={`/admin/teachers/${teacher.id}`}
                      >
                        {t("admin.teacherDetails")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">{t("admin.noTeachers")}</p>
        )}
        {result && result.totalPages > 1 && (
          <nav className="mt-5 flex items-center justify-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="btn-secondary"
            >
              {t("history.previous")}
            </button>
            <span>
              {t("history.page", {
                page: result.page,
                total: result.totalPages,
              })}
            </span>
            <button
              disabled={page >= result.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="btn-secondary"
            >
              {t("history.next")}
            </button>
          </nav>
        )}
        {promoting && (
          <Dialog
            labelledBy="promote-user-title"
            describedBy="promote-user-warning"
            onClose={() => setPromoting(undefined)}
          >
            <div className="panel">
              <h2 id="promote-user-title" className="section-title">
                {t("admin.promoteTitle", {
                  name: promoting.name ?? promoting.email,
                })}
              </h2>
              <p id="promote-user-warning" className="mt-3 text-slate-600">
                {t("admin.promoteWarning")}
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  autoFocus
                  disabled={Boolean(promotingId)}
                  onClick={() => setPromoting(undefined)}
                  className="btn-secondary"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  disabled={Boolean(promotingId)}
                  onClick={() => void promote()}
                  className="btn-primary"
                >
                  {promotingId
                    ? t("admin.promoting")
                    : t("admin.promoteToAdmin")}
                </button>
              </div>
            </div>
          </Dialog>
        )}
        {creating && (
          <Dialog labelledBy="create-user-title" onClose={closeCreate}>
            <form onSubmit={createUser} className="panel">
              <h2 id="create-user-title" className="section-title">
                {t("admin.createUserTitle")}
              </h2>
              <div className="mt-4 grid gap-4">
                <div>
                  <label htmlFor="create-user-name">{t("common.name")}</label>
                  <input
                    id="create-user-name"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    className="form-input"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="create-user-email">{t("admin.email")}</label>
                  <input
                    id="create-user-email"
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={createEmail}
                    onChange={(event) => setCreateEmail(event.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label htmlFor="create-user-password">
                    {t("auth.password")}
                  </label>
                  <PasswordInput
                    id="create-user-password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={createPassword}
                    onChange={(event) => {
                      setCreatePassword(event.target.value);
                      setPasswordMismatch(false);
                    }}
                    showPasswordLabel={t("admin.showPassword")}
                    hidePasswordLabel={t("admin.hidePassword")}
                  />
                </div>
                <div>
                  <label htmlFor="create-user-confirmation">
                    {t("admin.confirmPassword")}
                  </label>
                  <PasswordInput
                    id="create-user-confirmation"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={createConfirmation}
                    onChange={(event) => {
                      setCreateConfirmation(event.target.value);
                      setPasswordMismatch(false);
                    }}
                    showPasswordLabel={t("admin.showPassword")}
                    hidePasswordLabel={t("admin.hidePassword")}
                  />
                </div>
                {passwordMismatch && (
                  <p className="alert-error" role="alert">
                    {t("admin.passwordMismatch")}
                  </p>
                )}
                {error && (
                  <p className="alert-error" role="alert">
                    {t(`errors.${error}`)}
                  </p>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={createBusy}
                  onClick={closeCreate}
                  className="btn-secondary"
                >
                  {t("common.cancel")}
                </button>
                <button disabled={createBusy} className="btn-primary">
                  {t(
                    createBusy ? "admin.creatingUser" : "admin.createUser",
                  )}
                </button>
              </div>
            </form>
          </Dialog>
        )}
      </div>
    </main>
  );
}
