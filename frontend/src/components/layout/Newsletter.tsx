'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import Spinner from '../ui/Spinner';

const schema = z.object({ email: z.string().trim().email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export default function Newsletter() {
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormValues) => {
    try {
      const res = await api.newsletter(v.email);
      toast.success(res.message);
      reset();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="bg-mint">
      <div className="container flex flex-col items-start justify-between gap-5 py-9 md:flex-row md:items-center">
        <div>
          <h3 className="font-display text-2xl font-bold">Subscribe to our Newsletter</h3>
          <p className="mt-1 text-sm text-ink-muted">Weekly deals on fresh produce, new brews and beauty drops. No spam.</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="w-full md:w-auto" noValidate>
          <div className="flex w-full gap-2 md:w-[440px]">
            <input {...register('email')} placeholder="Enter your email address here" className="input h-11 bg-white" aria-label="Email address" />
            <button type="submit" disabled={formState.isSubmitting} className="btn-primary h-11 px-8">
              {formState.isSubmitting ? <Spinner /> : 'Submit'}
            </button>
          </div>
          {formState.errors.email && <p className="mt-1 text-xs text-danger">{formState.errors.email.message}</p>}
        </form>
      </div>
    </section>
  );
}
