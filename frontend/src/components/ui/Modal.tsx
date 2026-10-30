'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 animate-fade-in bg-black/30" onClick={onClose} />
      <div className={clsx('relative max-h-[92vh] w-full max-w-lg animate-pop overflow-y-auto rounded-t-2xl bg-white p-6 shadow-lift sm:rounded-2xl', className)}>
        <div className="mb-4 flex items-start justify-between gap-4">
          {title ? <h3 className="font-display text-lg font-bold">{title}</h3> : <span />}
          <button onClick={onClose} className="icon-btn border-0 bg-mint" aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
