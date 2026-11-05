import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { adminUiActions } from '../../../app/slices/adminUiSlice.js';

export function useOfficialTraderPage(title) {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle(title));
    dispatch(adminUiActions.setBreadcrumbs([
      { label: 'Operations', path: '/overview' },
      { label: 'Official AI Trader', path: '/official-trader' },
      { label: title, path: '/official-trader' },
    ]));
  }, [dispatch, title]);
}
