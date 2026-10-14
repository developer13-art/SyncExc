import { NavLink } from 'react-router-dom';

import { cn } from '../../lib/utils/cn.util.js';

export function SidebarItem({ to, icon: Icon, label, collapsed, badge, end = false, className }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        title={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition',
            collapsed && 'justify-center',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            className,
          )
        }
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
        {!collapsed ? (
          <>
            <span className="flex-1 truncate">{label}</span>
            {badge ? (
              <span className="rounded-full bg-destructive px-1.5 py-0.5 text-2xs font-semibold text-destructive-foreground">
                {badge}
              </span>
            ) : null}
          </>
        ) : null}
      </NavLink>
    </li>
  );
}