import { createSlice } from '@reduxjs/toolkit';

const THEME_STORAGE_KEY = 'syncexc:theme';
const SIDEBAR_STORAGE_KEY = 'syncexc:sidebar-collapsed';
const DENSITY_STORAGE_KEY = 'syncexc:density';

function readStoredValue(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable; ignore.
  }
}

const initialState = {
  theme: readStoredValue(THEME_STORAGE_KEY, 'light'),
  sidebarCollapsed: readStoredValue(SIDEBAR_STORAGE_KEY, 'false') === 'true',
  density: readStoredValue(DENSITY_STORAGE_KEY, 'comfortable'),
  commandPaletteOpen: false,
  mobileNavOpen: false,
  activeModal: null,
  pageTitle: null,
  breadcrumbs: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action) {
      state.theme = action.payload;
      writeStoredValue(THEME_STORAGE_KEY, action.payload);
    },
    toggleTheme(state) {
      const next = state.theme === 'light' ? 'dark' : 'light';
      state.theme = next;
      writeStoredValue(THEME_STORAGE_KEY, next);
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      writeStoredValue(SIDEBAR_STORAGE_KEY, String(state.sidebarCollapsed));
    },
    setSidebarCollapsed(state, action) {
      state.sidebarCollapsed = Boolean(action.payload);
      writeStoredValue(SIDEBAR_STORAGE_KEY, String(state.sidebarCollapsed));
    },
    setDensity(state, action) {
      state.density = action.payload;
      writeStoredValue(DENSITY_STORAGE_KEY, action.payload);
    },
    openCommandPalette(state) {
      state.commandPaletteOpen = true;
    },
    closeCommandPalette(state) {
      state.commandPaletteOpen = false;
    },
    toggleCommandPalette(state) {
      state.commandPaletteOpen = !state.commandPaletteOpen;
    },
    openMobileNav(state) {
      state.mobileNavOpen = true;
    },
    closeMobileNav(state) {
      state.mobileNavOpen = false;
    },
    setActiveModal(state, action) {
      state.activeModal = action.payload;
    },
    clearActiveModal(state) {
      state.activeModal = null;
    },
    setPageTitle(state, action) {
      state.pageTitle = action.payload;
    },
    setBreadcrumbs(state, action) {
      state.breadcrumbs = action.payload;
    },
    resetUi(state) {
      state.commandPaletteOpen = false;
      state.mobileNavOpen = false;
      state.activeModal = null;
      state.pageTitle = null;
      state.breadcrumbs = [];
    },
  },
});

export const uiActions = uiSlice.actions;
export const uiReducer = uiSlice.reducer;

export const selectTheme = (state) => state.ui.theme;
export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;
export const selectDensity = (state) => state.ui.density;
export const selectCommandPaletteOpen = (state) => state.ui.commandPaletteOpen;
export const selectMobileNavOpen = (state) => state.ui.mobileNavOpen;
export const selectActiveModal = (state) => state.ui.activeModal;
export const selectPageTitle = (state) => state.ui.pageTitle;
export const selectBreadcrumbs = (state) => state.ui.breadcrumbs;