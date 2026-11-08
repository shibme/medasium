import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export function PopoverContent({ className, align = 'center', sideOffset = 6, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align={align} sideOffset={sideOffset} collisionPadding={8}
        className={cn('z-[70] w-72 max-w-[calc(100vw-16px)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl outline-none animate-fade', className)} {...props} />
    </PopoverPrimitive.Portal>
  );
}
