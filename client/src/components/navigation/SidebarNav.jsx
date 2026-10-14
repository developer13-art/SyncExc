import { cn } from '../../lib/utils/cn.util.js';

export function SidebarNav({ children, className }) {
  return (
    <nav className={cn('flex flex-col gap-3 px-2 py-3', className)}>
      {children}
    </nav>
  );
}