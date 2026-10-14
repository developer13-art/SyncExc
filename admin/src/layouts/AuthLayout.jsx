import { Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-1/2 flex-col justify-between border-r border-border bg-muted/30 p-10 lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">SyncExc Admin</p>
            <p className="text-2xs text-muted-foreground">Administrator Console</p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-2xl font-semibold text-foreground">
            Centralized platform operations and governance.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            The Administrator Console orchestrates authorized operations across SyncExc without
            replacing any module's business logic. Every consequential action respects role
            permissions, workspace boundaries, financial integrity, exchange restrictions, and
            risk controls.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>· Least privilege: only the permissions your role requires.</li>
            <li>· Separation of duties: sensitive changes can require a second approver.</li>
            <li>· Auditable operations: every action records who, what, when, why, and outcome.</li>
            <li>· No silent data alteration: history is preserved.</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Authorized staff only. All actions are logged and audited.
        </p>
      </div>

      <div className="flex w-full flex-1 items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">SyncExc Admin</p>
              <p className="text-2xs text-muted-foreground">Administrator Console</p>
            </div>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}