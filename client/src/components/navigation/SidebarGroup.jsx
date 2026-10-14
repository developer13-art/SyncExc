import { cn } from '../../lib/utils/cn.util.js';

export function SidebarGroup({ label, collapsed, children, className }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {label && !collapsed ? (
        <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      ) : null}
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}