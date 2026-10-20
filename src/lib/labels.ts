// فایبرکار — برچسب‌های فارسی (تمام متن‌های وضعیت و نوع در یک نقطه)
import type {
  BoxStatus,
  BoxType,
  ConsumableCategory,
  ConsumableUnit,
  DeliveryStatus,
  InstallMethod,
  InstallStatus,
  OperationStatus,
  OperationType,
  PhotoCategory,
  PowerUnit,
  ProfileRole,
  ProjectStatus,
} from './types'

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planning: 'در برنامه‌ریزی',
  in_progress: 'در حال اجرا',
  suspended: 'متوقف‌شده',
  completed: 'تکمیل‌شده',
}

export const projectStatusVariants: Record<ProjectStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  planning: 'outline',
  in_progress: 'default',
  suspended: 'destructive',
  completed: 'secondary',
}

export const boxStatusLabels: Record<BoxStatus, string> = {
  not_installed: 'نصب‌نشده',
  installed: 'نصب‌شده',
  in_service: 'در سرویس',
  damaged: 'معیوب',
}

export const boxStatusVariants: Record<BoxStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  not_installed: 'outline',
  installed: 'secondary',
  in_service: 'default',
  damaged: 'destructive',
}

export const boxTypeLabels: Record<BoxType, string> = {
  dome: 'کپسولی (گنبدی)',
  inline: 'انشعابی خطی',
  wall: 'دیواری',
  floor: 'کف‌خواب',
  cabinet: 'اتاقک',
  odf: 'ترمینال/ODF',
  custom: 'سفارشی',
}

export const consumableCategoryLabels: Record<ConsumableCategory, string> = {
  cable_fiber: 'کابل و فیبر',
  connector: 'اتصالات (پیگتیل/آداپتور)',
  protection: 'حفاظت فیوژن',
  panel_terminal: 'کاست و ترمینال',
  tools_materials: 'ابزار و مواد',
  other: 'سایر',
}

export const consumableUnitLabels: Record<ConsumableUnit, string> = {
  count: 'عدد',
  meter: 'متر',
  pack: 'بسته',
  roll: 'رول',
  box: 'جعبه',
}

export const operationTypeLabels: Record<OperationType, string> = {
  visit: 'بازدید',
  box_install: 'نصب باکس',
  cable_prep: 'آماده‌سازی کابل',
  fusion: 'فیوژن',
  power_test: 'تست توان',
  drop_cable: 'دراپ‌کابل',
  troubleshooting: 'عیب‌یابی',
  delivery: 'تحویل',
  custom: 'سفارشی',
}

export const operationStatusLabels: Record<OperationStatus, string> = {
  planned: 'برنامه‌ریزی‌شده',
  in_progress: 'در حال اجرا',
  done: 'انجام‌شده',
  canceled: 'لغو‌شده',
}

export const operationStatusVariants: Record<OperationStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  planned: 'outline',
  in_progress: 'default',
  done: 'secondary',
  canceled: 'destructive',
}

export const powerUnitLabels: Record<PowerUnit, string> = {
  dBm: 'دسی‌بل‌میلی‌وات (dBm)',
  mW: 'میلی‌وات (mW)',
}

export const installMethodLabels: Record<InstallMethod, string> = {
  aerial: 'هوایی',
  duct: 'کانالی (داکت)',
  buried: 'زیرزمینی (دیفنگ)',
  wall: 'دیواری (نما)',
  custom: 'سفارشی',
}

export const installStatusLabels: Record<InstallStatus, string> = {
  not_installed: 'نصب‌نشده',
  in_progress: 'در حال نصب',
  installed: 'نصب‌شده',
}

export const installStatusVariants: Record<InstallStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  not_installed: 'outline',
  in_progress: 'default',
  installed: 'secondary',
}

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  not_delivered: 'تحویل‌نشده',
  delivered: 'تحویل‌شده',
}

export const deliveryStatusVariants: Record<DeliveryStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  not_delivered: 'outline',
  delivered: 'secondary',
}

export const profileRoleLabels: Record<ProfileRole, string> = {
  contractor: 'پیمانکار',
  network_executor: 'مجری شبکه',
  fusion_tech: 'تکنسین فیوژن',
  test_tech: 'تکنسین تست',
  box_installer: 'نصاب باکس',
  drop_executor: 'مجری دراپ‌کابل',
  supervisor: 'سرپرست',
  inspector: 'بازرس',
  custom: 'سفارشی',
}

export const photoCategoryLabels: Record<PhotoCategory, string> = {
  project: 'پروژه',
  box_install: 'نصب باکس',
  fusion: 'فیوژن',
  power_test: 'تست توان',
  drop_cable: 'دراپ‌کابل',
  delivery: 'تحویل',
  other: 'سایر',
}

export const viewTitles: Record<string, string> = {
  dashboard: 'داشبورد',
  projects: 'پروژه‌ها',
  project: 'جزئیات پروژه',
  route: 'جزئیات مسیر',
  box: 'جزئیات باکس',
  operations: 'عملیات اجرایی',
  fusion: 'فیوژن',
  'power-tests': 'تست توان',
  'drop-cables': 'دراپ‌کابل',
  consumables: 'لوازم مصرفی',
  photos: 'عکس‌ها',
  profiles: 'پروفایل و مشخصات کاری',
  reports: 'گزارش PDF',
  backup: 'پشتیبان‌گیری و بازیابی',
  search: 'جست‌وجوی سراسری',
}

// پیام‌های خطا و اعلان‌های مشترک فارسی
export const messages = {
  saved: 'با موفقیت ذخیره شد',
  updated: 'با موفقیت به‌روزرسانی شد',
  deleted: 'با موفقیت حذف شد',
  archived: 'به آرشیو منتقل شد',
  unarchived: 'از آرشیو خارج شد',
  error: 'خطایی رخ داد. دوباره تلاش کنید',
  requiredMissing: 'تکمیل فیلدهای الزامی لازم است',
  invalidNumber: 'مقدار عددی واردشده معتبر نیست',
  negativeNotAllowed: 'مقدار منفی پذیرفته نیست',
  deleteConfirmTitle: 'تأیید حذف',
  deleteConfirmDesc: 'با حذف این مورد، اطلاعات وابسته (شامل عکس‌ها) هم حذف می‌شود. این عمل بازگشت‌پذیر نیست.',
  photoSaved: 'عکس ذخیره شد',
  photoDeleted: 'عکس حذف شد',
  storageFull: 'فضای کافی برای ذخیره عکس وجود ندارد. فضای دستگاه را بررسی کنید',
  emptyTitle: 'موردی ثبت نشده است',
}
