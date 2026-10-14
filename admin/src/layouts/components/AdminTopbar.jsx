import { Menu } from 'lucide-react';
import { useDispatch } from 'react-redux';

import { IconButton } from '../../components/ui/IconButton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { AdminUserMenu } from './AdminUserMenu.jsx';

export function AdminTopbar() {
  const dispatch = useDispatch();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <IconButton
          label="Open navigation"
          className="lg:hidden"
          onClick={() => dispatch(adminUiActions.openMobileNav())}
        >
          <Menu className="h-4 w-4" />
        </IconButton>
        <div className="flex items-center gap-2 text-xs">
          <span className="hidden rounded-full border border-border bg-muted/30 px-2.5 py-0.5 font-medium text-muted-foreground md:inline-flex">
            Administrator Console
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch(adminUiActions.openCommandPalette())}
        >
          Search
        </Button>
        <AdminUserMenu />
      </div>
    </header>
  );
}