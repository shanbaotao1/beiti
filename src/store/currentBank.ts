import { create } from 'zustand'

const KEY = 'beiti_current_bank'

interface CurrentBankState {
  bankId: string | null
  setBank: (id: string) => void
  clear: () => void
}

export const useCurrentBank = create<CurrentBankState>((set) => ({
  bankId: (() => {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  })(),
  setBank: (id) => {
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* ignore */
    }
    set({ bankId: id })
  },
  clear: () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    set({ bankId: null })
  }
}))
