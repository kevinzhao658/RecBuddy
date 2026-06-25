import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Unit } from './units'

const KEY = 'rb-unit'
const UnitCtx = createContext<{ unit: Unit; setUnit: (u: Unit) => void }>({ unit: 'mi', setUnit: () => {} })

// Guarded so it's safe where localStorage is absent (tests, SSR).
const read = (): Unit => { try { return localStorage.getItem(KEY) === 'km' ? 'km' : 'mi' } catch { return 'mi' } }
const write = (u: Unit) => { try { localStorage.setItem(KEY, u) } catch { /* ignore */ } }

/** Coach's distance unit preference (persisted client-side; per-device). */
export const useUnit = () => useContext(UnitCtx)

export function UnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<Unit>(read)
  const setUnit = useCallback((u: Unit) => { write(u); setUnitState(u) }, [])
  return <UnitCtx.Provider value={{ unit, setUnit }}>{children}</UnitCtx.Provider>
}
