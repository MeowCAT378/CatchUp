'use client';

import { useTranslation } from 'react-i18next';

export default function Home() {
  const { t } = useTranslation();
  return <main className="page-shell"><div className="page-content flex min-h-screen max-w-4xl items-center"><section className="panel w-full py-10 sm:p-12"><p className="badge">CatchUp</p><h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-slate-900 sm:text-6xl">{t('room.landingTitle')}</h1><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">{t('room.landingSubtitle')}</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><a href="/login" className="btn-primary px-6">{t('room.teacherEntry')}</a><a href="/join" className="btn-secondary px-6">{t('room.playerEntry')}</a></div></section></div></main>;
}
