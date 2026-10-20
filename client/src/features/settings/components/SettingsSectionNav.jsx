import { Link } from 'react-router-dom';

import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

const sections = [
  { label: 'Overview', path: ROUTES.app.settings.overview },
  { label: 'Profile', path: ROUTES.app.settings.profile },
  { label: 'Preferences', path: ROUTES.app.settings.preferences },
  { label: 'Trading', path: ROUTES.app.settings.trading },
  { label: 'Security', path: ROUTES.app.settings.security },
  { label: 'Sessions', path: ROUTES.app.settings.sessions },
  { label: 'Devices', path: ROUTES.app.settings.devices },
  { label: 'Notifications', path: ROUTES.app.settings.notifications },
];

export function SettingsSectionNav({ activePath }) {
  return (
    <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto border-b border-border pb-2">
      {sections.map((section) => (
        <Link
          key={section.path}
          to={section.path}
          aria-current={activePath === section.path ? 'page' : undefined}
          className={cn(
            'whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors',
            activePath === section.path
              ? 'bg-primary/15 font-medium text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
