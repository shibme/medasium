import * as React from 'react';
import { cn } from '@/lib/utils';

export const inputBase =
  'flex h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(inputBase, 'file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-sm file:font-medium', className)} {...props} />;
}
/** Input with a trailing unit / suffix label. */
export function InputSuffix({ suffix, className, ...props }: React.ComponentProps<'input'> & { suffix: string }) {
  return (
    <div className="relative">
      <input className={cn(inputBase, 'pr-14 tabular-nums', className)} {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">{suffix}</span>
    </div>
  );
}
export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(inputBase, 'h-auto min-h-20 resize-y', className)} {...props} />;
}
