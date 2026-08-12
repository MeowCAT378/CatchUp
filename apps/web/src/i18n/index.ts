'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { auth } from './auth';
import { common } from './common';
import { errors } from './errors';
import { player } from './player';
import { quiz } from './quiz';
import { results } from './results';
import { room } from './room';

if (!i18n.isInitialized) i18n.use(initReactI18next).init({ resources: { th: { translation: { ...common.th, ...auth.th, ...quiz.th, ...room.th, ...player.th, ...results.th, ...errors.th } }, en: { translation: { ...common.en, ...auth.en, ...quiz.en, ...room.en, ...player.en, ...results.en, ...errors.en } } }, lng: 'th', fallbackLng: 'th', interpolation: { escapeValue: false } });

export default i18n;
