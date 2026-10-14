import { Link } from 'react-router-dom';
import { FlaskConical, MoreVertical, Archive, Play } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../../../components/ui/Dropdown.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

const TYPE_LABELS = {
  paper_trading: 'Paper trading',
  historical_backtest: 'Historical backtest',
  market_replay: 'Market replay',
  workflow_test: 'Workflow test',
  synchronization_test: 'Synchronization test',
  scenario_test: 'Scenario test',
};

export function EnvironmentCard({ environment, onArchive, onRun, className }) {
  if (!environment) {
    return null;
  }

  const linkTo = ROUTES.app.simulation.environment(environment.id);
  const isReady = environment.status === 'ready' || environment.status === 'completed';

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <Link to={linkTo} className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {environment.name}
              </p>
              <Badge variant={isReady ? 'success' : environment.status === 'failed' ? 'destructive' : 'warning'}>
                {environment.status ?? 'draft'}
              </Badge>
            </div>
            <p className="mt-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
              {TYPE_LABELS[environment.type] ?? environment.type ?? 'simulation'}
            </p>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton label="Actions" size="sm">
              <MoreVertical className="h-4 w-4" />
            </IconButton>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem asChild>
              <Link to={linkTo}>View environment</Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link to={`${ROUTES.app.simulation.runs}?environmentId=${environment.id}`}>
                View runs
              </Link>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={() => onRun?.(environment)}>
              <Play className="h-3.5 w-3.5" /> Start run
            </DropdownItem>
            <DropdownItem
              onSelect={() => onArchive?.(environment)}
              className="text-destructive focus:text-destructive"
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      <Link to={linkTo} className="block border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {environment.instrumentCount !== undefined ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {environment.instrumentCount} instrument
              {environment.instrumentCount !== 1 ? 's' : ''}
            </span>
          ) : null}
          {environment.runCount !== undefined ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {environment.runCount} run{environment.runCount !== 1 ? 's' : ''}
            </span>
          ) : null}
          {environment.virtualBalance ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {environment.virtualBalance}
            </span>
          ) : null}
        </div>

        <p className="mt-2.5 text-2xs text-muted-foreground">
          {environment.lastActivityAt
            ? `Last activity ${formatRelativeTime(environment.lastActivityAt)}`
            : 'No recent activity'}
        </p>
      </Link>
    </Card>
  );
}