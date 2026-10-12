import { Suspense } from 'react';
import AuthExperience from '@/components/auth/AuthExperience';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return <Suspense fallback={null}><AuthExperience initialMode="login" /></Suspense>;
}
