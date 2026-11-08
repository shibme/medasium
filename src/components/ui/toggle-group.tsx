import * as React from 'react';
import * as TG from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

export function ToggleGroup({ className, ...props }: React.ComponentProps<typeof TG.Root>) {
  return <TG.Root className={cn('inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5', className)} {...props} />;
}
export function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof TG.Item>) {
  return (
    <TG.Item
      className={cn('inline-flex h-7 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:bg-secondary [&_svg]:size-3.5', className)}
      {...props}
    />
  );
}
