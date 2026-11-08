import * as React from 'react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuRadioGroup = DM.RadioGroup;
export function DropdownMenuContent({ className, sideOffset = 6, align = 'end', ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content sideOffset={sideOffset} align={align} collisionPadding={8}
        className={cn('z-[70] min-w-[12rem] max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-xl animate-fade', className)} {...props} />
    </DM.Portal>
  );
}
export function DropdownMenuItem({ className, variant, ...props }: React.ComponentProps<typeof DM.Item> & { variant?: 'destructive' }) {
  return (
    <DM.Item
      className={cn('relative flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
        variant === 'destructive' && 'text-destructive focus:bg-destructive-soft focus:text-destructive [&_svg]:!text-destructive', className)}
      {...props}
    />
  );
}
export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem className={cn('relative flex cursor-default select-none items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-8 text-sm outline-none focus:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground', className)} {...props}>
      {children}
      <span className="absolute right-2.5 flex size-4 items-center justify-center"><DM.ItemIndicator><Check className="!text-primary" /></DM.ItemIndicator></span>
    </DM.RadioItem>
  );
}
export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn('px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)} {...props} />;
}
export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
