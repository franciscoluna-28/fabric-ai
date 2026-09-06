import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface ActiveProjectState {
  lastProjectId: string | null
  setLastProjectId: (id: string | null) => void
}

export const useActiveProjectStore = create<ActiveProjectState>()(
  persist(
    (set) => ({
      lastProjectId: null,
      setLastProjectId: (lastProjectId) => set({ lastProjectId }),
    }),
    {
      name: 'active-project',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)