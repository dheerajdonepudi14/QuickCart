import { Suspense } from 'react';
import AuthExperience from '@/components/auth/AuthExperience';

export const metadata = { title: 'Create account' };

export default function RegisterPage() {
  return <Suspense fallback={null}><AuthExperience initialMode="register" /></Suspense>;
}
