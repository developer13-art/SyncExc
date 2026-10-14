import { createSlice } from '@reduxjs/toolkit';

const SIDEBAR_KEY = 'syncexc:admin:sidebar-collapsed';
const THEME_KEY = 'syncexc:admin:theme';

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore.
  }
}

const initialState = {
  theme: readStored(THEME_KEY, 'light'),
  sidebarCollapsed: readStored(SIDEBAR_KEY, 'false') === 'true',
  mobileNavOpen: false,
  pageTitle: null,
  breadcrumbs: [],
  commandPaletteOpen: false,
};

const adminUiSlice = createSlice({
  name: 'adminUi',
  initialState,
  reducers: {
    setTheme(state, action) {
      state.theme = action.payload;
      writeStored(THEME_KEY, action.payload);
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      writeStored(SIDEBAR_KEY, String(state.sidebarCollapsed));
    },
    setSidebarCollapsed(state, action) {
      state.sidebarCollapsed = Boolean(action.payload);
      writeStored(SIDEBAR_KEY, String(state.sidebarCollapsed));
    },
    openMobileNav(state) {
      state.mobileNavOpen = true;
    },
    closeMobileNav(state) {
      state.mobileNavOpen = false;
    },
    setPageTitle(state, action) {
      state.pageTitle = action.payload;
    },
    setBreadcrumbs(state, action) {
      state.breadcrumbs = action.payload;
    },
    openCommandPalette(state) {
      state.commandPaletteOpen = true;
    },
    closeCommandPalette(state) {
      state.commandPaletteOpen = false;
    },
  },
});

export const adminUiActions = adminUiSlice.actions;
export const adminUiReducer = adminUiSlice.reducer;

export const selectAdminTheme = (state) => state.ui.theme;
export const selectAdminSidebarCollapsed = (state) => state.ui.sidebarCollapsed;
export const selectAdminMobileNavOpen = (state) => state.ui.mobileNavOpen;
export const selectAdminPageTitle = (state) => state.ui.pageTitle;
export const selectAdminBreadcrumbs = (state) => state.ui.breadcrumbs;
export const selectAdminCommandPaletteOpen = (state) => state.ui.commandPaletteOpen;