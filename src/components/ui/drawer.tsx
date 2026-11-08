import * as React from 'react';
import { Drawer as V } from 'vaul';
import { cn } from '@/lib/utils';

export const Drawer = V.Root;
export const DrawerTitle = V.Title;
export const DrawerDescription = V.Description;
export function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof V.Content>) {
  return (
    <V.Portal>
      <V.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <V.Content
        className={cn('fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t bg-card outline-none', className)}
        {...props}>
        <div aria-hidden className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
        {children}
      </V.Content>
    </V.Portal>
  );
}
