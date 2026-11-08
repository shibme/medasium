import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-[13px] font-medium leading-none text-muted-foreground', className)} {...props} />;
}
/** Label + control stacked. */
export function Field({ label, hint, children, className }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = React.useId();
  const child = React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id: (children.props as { id?: string }).id ?? id }) : children;
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {child}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
