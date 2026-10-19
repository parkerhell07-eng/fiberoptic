'use client'

// فایبرکار — شل اصلی اپلیکیشن (تک‌صفحه‌ای، RTL، موبایل‌اول)
import { useEffect, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Cable,
  ClipboardList,
  FileDown,
  FolderKanban,
  House,
  Image as ImageIcon,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAppStore, installHashSync, type ViewKey } from '@/store/app-store'
import DashboardView from '@/components/fiberkar/dashboard'
import ProjectsView from '@/components/fiberkar/projects-view'
import ProjectDetailView from '@/components/fiberkar/project-detail'
import RouteDetailView from '@/components/fiberkar/route-detail'
import BoxDetailView from '@/components/fiberkar/box-detail'
import OperationsView from '@/components/fiberkar/operations-view'
import FusionView from '@/components/fiberkar/fusion-view'
import PowerTestsView from '@/components/fiberkar/power-tests-view'
import DropCablesView from '@/components/fiberkar/drop-cables-view'
import PhotosView from '@/components/fiberkar/photos-view'
import ProfilesView from '@/components/fiberkar/profiles-view'
import ReportsView from '@/components/fiberkar/reports-view'
import BackupView from '@/components/fiberkar/backup-view'
import SearchView from '@/components/fiberkar/search-view'

const VIEW_COMPONENTS: Record<ViewKey, React.ComponentType> = {
  dashboard: DashboardView,
  projects: ProjectsView,
  project: ProjectDetailView,
  route: RouteDetailView,
  box: BoxDetailView,
  operations: OperationsView,
  fusion: FusionView,
  'power-tests': PowerTestsView,
  'drop-cables': DropCablesView,
  photos: PhotosView,
  profiles: ProfilesView,
  reports: ReportsView,
  backup: BackupView,
  search: SearchView,
}

export default function Home() {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const { resolvedTheme, setTheme } = useTheme()
  // تشخیص hydration بدون setState داخل effect
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  useEffect(() => {
    return installHashSync()
  }, [])

  useEffect(() => {
    // ثبت Service Worker فقط در بیلد production (در حالت dev پایدار نیست)
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // اطلاع نسخه جدید — toast با دکمه به‌روزرسانی
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing
            if (!nw) return
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                toast.info('نسخه جدید فیبرکار آماده است', {
                  description: 'برای اعمال به‌روزرسانی، بازخوانی کنید',
                  action: {
                    label: 'به‌روزرسانی',
                    onClick: () => {
                      nw.postMessage({ type: 'SKIP_WAITING' })
                    },
                  },
                  duration: 15000,
                })
              }
            })
          })
        })
        .catch(() => {})
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }
  }, [])

  // میان‌بر صفحه‌کلید «/» برای جست‌وجوی سراسری
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (!typing && e.key === '/') {
        e.preventDefault()
        navigate('search')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const View = VIEW_COMPONENTS[view] ?? DashboardView
  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  const moreActive = view === 'photos' || view === 'profiles' || view === 'reports' || view === 'backup' || view === 'search'

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* هدر */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
          <button
            type="button"
            onClick={() => useAppStore.getState().reset()}
            className="flex items-center gap-2"
            aria-label="صفحه اصلی فیبرکار"
          >
            <img src="/icons/icon-192.png" alt="لوگوی فیبرکار" className="size-8 rounded-lg" />
            <span className="text-lg font-bold">فیبرکار</span>
          </button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => navigate('search')}
            aria-label="جست‌وجوی سراسری"
          >
            <Search className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-11" onClick={toggleTheme} aria-label="تغییر حالت روشن/تاریک">
            <Sun className="size-5 dark:hidden" />
            <Moon className="hidden size-5 dark:block" />
          </Button>
        </div>
      </header>

      {/* محتوای اصلی */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-4">
        {mounted ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <View />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex justify-center py-16 text-sm text-muted-foreground">در حال بارگذاری فیبرکار…</div>
        )}
      </main>

      {/* فوتر چسبان به پایین */}
      <footer className="mt-auto border-t bg-muted/40 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-3">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 text-xs text-muted-foreground">
          <span>فیبرکار نسخه ۱٫۱</span>
          <span className="flex items-center gap-1">
            <WifiOff className="size-3.5" />
            کاملاً آفلاین — داده‌ها فقط روی همین دستگاه
          </span>
        </div>
      </footer>

      {/* نویگیشن پایین (استفاده با یک دست) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="نویگیشن اصلی"
      >
        <div className="mx-auto grid w-full max-w-3xl grid-cols-5">
          <NavItem icon={<House className="size-5" />} label="داشبورد" active={view === 'dashboard'} onClick={() => navigate('dashboard')} />
          <NavItem icon={<FolderKanban className="size-5" />} label="پروژه‌ها" active={view === 'projects' || view === 'project' || view === 'route' || view === 'box'} onClick={() => navigate('projects')} />
          <NavItem icon={<ClipboardList className="size-5" />} label="عملیات" active={view === 'operations' || view === 'fusion' || view === 'power-tests'} onClick={() => navigate('operations')} />
          <NavItem icon={<Cable className="size-5" />} label="دراپ‌کابل" active={view === 'drop-cables'} onClick={() => navigate('drop-cables')} />
          <BottomMoreMenu navigate={navigate} active={moreActive} />
        </div>
      </nav>
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[10px] transition-colors sm:text-xs ${
        active ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function MoreItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-2 text-xs font-medium transition-colors hover:bg-accent"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  )
}

function BottomMoreMenu({ navigate, active }: { navigate: (v: ViewKey) => void; active: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-current={active ? 'page' : undefined}
          className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[10px] transition-colors sm:text-xs ${
            active ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Menu className="size-5" />
          بیشتر
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl" dir="rtl">
        <SheetHeader>
          <SheetTitle>بیشتر</SheetTitle>
        </SheetHeader>
        <nav className="grid grid-cols-4 gap-2 pb-6" aria-label="منوی بیشتر">
          <MoreItem
            icon={<ImageIcon className="size-5" />}
            label="عکس‌ها"
            onClick={() => {
              navigate('photos')
              setOpen(false)
            }}
          />
          <MoreItem
            icon={<UserRound className="size-5" />}
            label="پروفایل‌ها"
            onClick={() => {
              navigate('profiles')
              setOpen(false)
            }}
          />
          <MoreItem
            icon={<FileDown className="size-5" />}
            label="گزارش PDF"
            onClick={() => {
              navigate('reports')
              setOpen(false)
            }}
          />
          <MoreItem
            icon={<ShieldCheck className="size-5" />}
            label="پشتیبان‌گیری"
            onClick={() => {
              navigate('backup')
              setOpen(false)
            }}
          />
          <MoreItem
            icon={<Search className="size-5" />}
            label="جست‌وجو"
            onClick={() => {
              navigate('search')
              setOpen(false)
            }}
          />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
