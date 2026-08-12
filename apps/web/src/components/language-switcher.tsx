'use client';

import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const setLanguage = (language: 'th' | 'en') => { localStorage.setItem('catchup:language', language); void i18n.changeLanguage(language); };
  return <div className="inline-flex rounded border bg-white p-1 text-slate-900" aria-label={t('common.language')}><button type="button" onClick={() => setLanguage('th')} className={`rounded px-2 py-1 focus-visible:outline-2 ${i18n.language === 'th' ? 'bg-indigo-600 text-white' : ''}`}>ไทย</button><button type="button" onClick={() => setLanguage('en')} className={`rounded px-2 py-1 focus-visible:outline-2 ${i18n.language === 'en' ? 'bg-indigo-600 text-white' : ''}`}>EN</button></div>;
}
