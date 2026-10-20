'use client'

// فایبرکار — استور ناوبری (SPA داخل مسیر /) + همگام‌سازی با location.hash
//
// طراحی v1.1: مرورگر/وب‌ویو «تنها منبع حقیقت» تاریخچه است.
//  - در boot، اگر کاربر مستقیم روی لینک عمیق وارد شود، یک رکورد «داشبورد» زیر
//    نمای فعلی قرار می‌گیرد تا Back (سخت‌افزاری یا دکمه اپ) همیشه رفتار درست داشته باشد.
//  - back() واقعاً history.back() می‌زند؛ دکمه Back اندروید و دکمه اپ همیشه هم‌رفتارند.
//  - بعد از حذف رکورد، replace() استفاده شود تا Back به رکورد حذف‌شده برنگردد.
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
  | 'consumables'
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
  /** برای میان‌برهای داشبورد: باز شدن خودکار فرم ایجاد */
  intent?: 'create'
}

interface AppState {
  view: ViewKey
  params: NavParams
  navigate: (view: ViewKey, params?: NavParams) => void
  replace: (view: ViewKey, params?: NavParams) => void
  back: () => void
  reset: () => void
}

const VALID_VIEWS: ViewKey[] = [
  'dashboard', 'projects', 'project', 'route', 'box', 'operations', 'fusion',
  'power-tests', 'drop-cables', 'consumables', 'photos', 'profiles', 'reports', 'backup', 'search',
]

const INTENT_KEYS = ['intent'] as const
const PARAM_KEYS = [
  'projectId', 'routeId', 'boxId', 'operationId', 'fusionId', 'powerTestId', 'dropCableId', 'photoId', 'q',
] as const

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
    for (const key of PARAM_KEYS) {
      const v = usp.get(key)
      if (v) params[key] = v
    }
    const cat = usp.get('category')
    // فقط دسته‌های معتبر پذیرفته می‌شوند
    const VALID_CATS = ['project', 'box_install', 'fusion', 'power_test', 'drop_cable', 'delivery', 'other']
    if (cat && (VALID_CATS as string[]).includes(cat)) params.category = cat as PhotoCategory
    for (const key of INTENT_KEYS) {
      const v = usp.get(key)
      if (v === 'create') params.intent = 'create'
    }
  }
  return { view, params }
}

function currentHash(): string {
  if (typeof window === 'undefined') return '#/'
  const h = window.location.hash
  return h && h !== '#' ? h : '#/'
}

function applyHash(hash: string): void {
  if (typeof window === 'undefined') return
  if (currentHash() !== hash) {
    window.history.pushState(null, '', hash)
  }
}

function replaceHash(hash: string): void {
  if (typeof window === 'undefined') return
  if (currentHash() !== hash) {
    window.history.replaceState(null, '', hash)
  }
}

export const useAppStore = create<AppState>((set) => ({
  view: 'dashboard',
  params: {},
  navigate: (view, params = {}) => {
    applyHash(`#/${view}${paramsToQuery(params)}`)
    set(hashToState())
  },
  replace: (view, params = {}) => {
    replaceHash(`#/${view}${paramsToQuery(params)}`)
    set(hashToState())
  },
  back: () => {
    // مرورگر/وب‌ویو منبع حقیقت است؛ دکمه Back اندروید هم همین مسیر را می‌رود
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      applyHash('#/')
      set(hashToState())
    }
  },
  reset: () => {
    // بازگشت به ریشه بدون رشد تاریخچه
    replaceHash('#/')
    set(hashToState())
  },
}))

/** گوش دادن به دکمه Back مرورگر — در شل اپ نصب می‌شود */
export function installHashSync(): () => void {
  const sync = () => {
    const { view, params } = hashToState()
    useAppStore.setState({ view, params })
  }
  const onPop = () => sync()
  // hashchange برای تغییر مستقیم hash (بوکمارک/لینک خارجی) — popstate برای دکمه Back
  const onHash = () => sync()

  // boot: اگر مستقیم روی نمای عمیق باز شده، زیر آن «داشبورد» بگذار تا Back منطقی باشد
  if (typeof window !== 'undefined' && currentHash() !== '#/' && window.history.length <= 1) {
    window.history.replaceState(null, '', '#/')
    window.history.pushState(null, '', currentHash())
  }

  window.addEventListener('popstate', onPop)
  window.addEventListener('hashchange', onHash)
  sync()
  return () => {
    window.removeEventListener('popstate', onPop)
    window.removeEventListener('hashchange', onHash)
  }
}
