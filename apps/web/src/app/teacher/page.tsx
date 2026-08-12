import { getServerSession } from 'next-auth'; import { authOptions } from '@/auth'; import { redirect } from 'next/navigation'; import TeacherClient from './teacher-client';
export default async function TeacherPage() { const session = await getServerSession(authOptions); if (!session) redirect('/login'); return <TeacherClient token={session.accessToken} />; }
