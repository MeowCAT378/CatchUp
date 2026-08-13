'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export function BackButton({ href, disabled = false }: { href: string; disabled?: boolean }) {
  const { t } = useTranslation();
  const content = <><span aria-hidden="true">←</span>{t('common.back')}</>;
  return disabled ? <button type="button" disabled className="back-button">{content}</button> : <Link href={href} className="back-button">{content}</Link>;
}
