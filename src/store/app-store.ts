'use client'

// فایبرکار — استور ناوبری (SPA داخل مسیر /) + همگام‌سازی با location.hash
import { create } from 'zustand'
import type { ID, PhotoCategory } from '@/lib/types'

export type ViewKey =
  | 'dashboard'
  | 'projects'
  | 'project'
  | 'route'
  | 'box'
  | 'operations'
  | 'fusion'
  | 'power-tests'
  | 'drop-cables'
  | 'photos'
  | 'profiles'
  | 'reports'
  | 'backup'
  | 'search'

export interface NavParams {
  projectId?: ID
  routeId?: ID
  boxId?: ID
  operationId?: ID
  fusionId?: ID
  powerTestId?: ID
  dropCableId?: ID
  category?: PhotoCategory
  photoId?: ID
  q?: string
}

interface AppState {
  view: ViewKey
  params: NavParams
  history: Array<{ view: ViewKey; params: NavParams }>
  navigate: (view: ViewKey, params?: NavParams) => void
  replace: (view: ViewKey, params?: NavParams) => void
  back: () => void
  reset: () => void
}

const VALID_VIEWS: ViewKey[] = [
  'dashboard', 'projects', 'project', 'route', 'box', 'operations', 'fusion',
  'power-tests', 'drop-cables', 'photos', 'profiles', 'reports', 'backup', 'search',
]

function paramsToQuery(params: NavParams): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

function hashToState(): { view: ViewKey; params: NavParams } {
  if (typeof window === 'undefined') return { view: 'dashboard', params: {} }
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (!raw) return { view: 'dashboard', params: {} }
  const [viewPart, queryPart] = raw.split('?')
  const view = (VALID_VIEWS as string[]).includes(viewPart) ? (viewPart as ViewKey) : 'dashboard'
  const params: NavParams = {}
  if (queryPart) {
    const usp = new URLSearchParams(queryPart)
    for (const key of ['projectId', 'routeId', 'boxId', 'operationId', 'fusionId', 'powerTestId', 'dropCableId', 'photoId', 'q'] as const) {
      const v = usp.get(key)
      if (v) params[key] = v
    }
    const cat = usp.get('category')
    if (cat) params.category = cat as PhotoCategory
  }
  return { view, params }
}

function writeHash(view: ViewKey, params: NavParams): void {
  const next = `#/${view}${paramsToQuery(params)}`
  if (typeof window !== 'undefined' && window.location.hash !== next) {
    window.history.pushState(null, '', next)
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'dashboard',
  params: {},
  history: [],
  navigate: (view, params = {}) => {
    writeHash(view, params)
    set((s) => ({ view, params, history: [...s.history.slice(-30), { view: s.view, params: s.params }] }))
  },
  replace: (view, params = {}) => {
    writeHash(view, params)
    set({ view, params })
  },
  back: () => {
    const { history } = get()
    if (history.length > 0) {
      const prev = history[history.length - 1]
      writeHash(prev.view, prev.params)
      set({ view: prev.view, params: prev.params, history: history.slice(0, -1) })
    } else {
      writeHash('dashboard', {})
      set({ view: 'dashboard', params: {} })
    }
  },
  reset: () => {
    writeHash('dashboard', {})
    set({ view: 'dashboard', params: {}, history: [] })
  },
}))

/** گوش دادن به دکمه Back مرورگر — در شل اپ نصب می‌شود */
export function installHashSync(): () => void {
  const onPop = () => {
    const { view, params } = hashToState()
    useAppStore.setState({ view, params, history: [] })
  }
  window.addEventListener('popstate', onPop)
  // بازیابی وضعیت پس از بازکردن مجدد
  onPop()
  return () => window.removeEventListener('popstate', onPop)
}
