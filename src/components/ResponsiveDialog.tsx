import { useState, type ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from './ui/drawer';

interface Props {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Sticky action row (buttons). */
  footer?: ReactNode;
  className?: string;
  wide?: boolean;
}

/** Bottom sheet on phones, centred dialog on desktop. Mount it to open it; it calls onClose after the close animation. */
export function ResponsiveDialog({ title, description, onClose, children, footer, className, wide }: Props) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(true);
  const close = (o: boolean) => { if (!o) { setOpen(false); setTimeout(onClose, desktop ? 120 : 260); } };
  const body = <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:px-5', className)}>{children}</div>;
  const foot = footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5">{footer}</div>;
  const desc = description ? 'block' : 'sr-only';
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className={wide ? 'max-w-2xl' : undefined} aria-describedby={undefined}>
          <div className="shrink-0 px-5 pb-3 pt-5 pr-12">
            <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
            <DialogDescription className={cn('mt-1 text-sm text-muted-foreground', desc)}>{description ?? title}</DialogDescription>
          </div>
          {body}{foot}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={close} repositionInputs={false}>
      <DrawerContent aria-describedby={undefined}>
        <div className="shrink-0 px-4 pb-3 pt-2">
          <DrawerTitle className="text-lg font-semibold tracking-tight">{title}</DrawerTitle>
          <DrawerDescription className={cn('mt-1 text-sm text-muted-foreground', desc)}>{description ?? title}</DrawerDescription>
        </div>
        {body}{foot}
      </DrawerContent>
    </Drawer>
  );
}
