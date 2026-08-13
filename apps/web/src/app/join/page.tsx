'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { BackButton } from '@/components/back-button';
import { api, ApiError } from '@/lib/api';
import { saveParticipant } from '@/lib/participant';

export default function JoinPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => setCode((new URLSearchParams(window.location.search).get('code') ?? '').replace(/\D/g, '').slice(0, 6)), []);
  async function submit(form: FormData) {
    setLoading(true);
    try {
      const joined = await api<{ participantId: string; participantToken: string; roomCode: string }>('/rooms/join', { method: 'POST', body: JSON.stringify({ code, displayName: form.get('displayName') }) });
      saveParticipant(joined.roomCode, { id: joined.participantId, token: joined.participantToken });
      router.push(`/play/${joined.roomCode}`);
    } catch (e) { setError(t(`errors.${e instanceof ApiError ? e.code : 'REQUEST_FAILED'}`)); } finally { setLoading(false); }
  }
  return <main className="page-shell"><section className="page-content flex min-h-screen max-w-md flex-col justify-center"><BackButton href="/" /><div className="panel mt-4 w-full"><p className="badge">CatchUp</p><h1 className="mt-4 text-3xl font-black text-slate-900">{t('player.joinRoom')}</h1><form action={submit} className="mt-7 grid gap-4"><label className="font-medium">{t('common.roomCode')}<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required className="form-input" /></label><label className="font-medium">{t('player.displayName')}<input name="displayName" required className="form-input" /></label><button disabled={loading} className="btn-primary">{loading ? t('common.loading') : t('room.join')}</button>{error && <p role="alert" className="alert-error">{error}</p>}</form></div></section></main>;
}
