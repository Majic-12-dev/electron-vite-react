import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Preferences = {
  darkMode: boolean
  defaultOutputDir: string
}

const MAX_RECENT_TOOLS = 8

type UiState = {
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
}

type AppState = UiState & {
  preferences: Preferences
  recentTools: string[]
  setDarkMode: (enabled: boolean) => void
  setDefaultOutputDir: (dir: string) => void
  addRecentTool: (toolId: string) => void
  clearRecentTools: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      preferences: {
        darkMode: false,
        defaultOutputDir: '',
      },
      recentTools: [],
      setDarkMode: (enabled) =>
        set((state) => ({
          preferences: { ...state.preferences, darkMode: enabled },
        })),
      setDefaultOutputDir: (dir) =>
        set((state) => ({
          preferences: { ...state.preferences, defaultOutputDir: dir },
        })),
      addRecentTool: (toolId) =>
        set((state) => {
          const filtered = state.recentTools.filter((id) => id !== toolId)
          return {
            recentTools: [toolId, ...filtered].slice(0, MAX_RECENT_TOOLS),
          }
        }),
      clearRecentTools: () => set({ recentTools: [] }),
    }),
    {
      name: 'docflow-pro-store',
      partialize: (state) => ({
        preferences: state.preferences,
        recentTools: state.recentTools,
      }),
    },
  ),
)
