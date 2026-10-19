// فایبرکار — انواع داده (Data types)
// تمام رکوردها به‌صورت محلی در IndexedDB ذخیره می‌شوند (کاملاً آفلاین).

export type ID = string

// ================= پروژه =================
export type ProjectStatus = 'planning' | 'in_progress' | 'suspended' | 'completed'

export interface Project {
  id: ID
  name: string
  code: string
  client: string // کارفرما
  contractorProfileId?: ID // پیمانکار (از پروفایل‌ها) — اختیاری
  executorProfileId?: ID // مجری (از پروفایل‌ها) — اختیاری
  area: string // محدوده
  startDate?: string // 'YYYY-MM-DD' (میلادی ذخیره، شمسی نمایش)
  status: ProjectStatus
  description: string
  archived: 0 | 1
  createdAt: number
  updatedAt: number
}

// ================= مسیر شبکه =================
export interface Route {
  id: ID
  projectId: ID
  name: string
  code: string
  description: string
  archived: 0 | 1
  createdAt: number
  updatedAt: number
}

// ================= باکس =================
export type BoxStatus = 'not_installed' | 'installed' | 'in_service' | 'damaged'

export interface Box {
  id: ID
  projectId: ID
  routeId: ID
  number: string
  location: string // محل نصب
  cableSpec: string // مشخصات کابل
  capacity: string // ظرفیت (مثلاً 1x8) — اختیاری
  status: BoxStatus
  description: string
  archived: 0 | 1
  createdAt: number
  updatedAt: number
}

// ================= عملیات =================
export type OperationType =
  | 'visit'
  | 'box_install'
  | 'cable_prep'
  | 'fusion'
  | 'power_test'
  | 'drop_cable'
  | 'troubleshooting'
  | 'delivery'
  | 'custom'

export type OperationStatus = 'planned' | 'in_progress' | 'done' | 'canceled'

export interface Operation {
  id: ID
  projectId: ID
  routeId?: ID
  boxId?: ID
  type: OperationType
  customTypeLabel: string // عنوان نوع سفارشی
  title: string
  date: string // 'YYYY-MM-DD'
  status: OperationStatus
  assigneeProfileId?: ID // مسئول (پروفایل)
  assigneeName: string // اسنپ‌شات نام مسئول در زمان ثبت
  assigneeRole: string // اسنپ‌شات نقش مسئول در زمان ثبت
  description: string
  techSpecs: string // مشخصات فنی
  createdAt: number
  updatedAt: number
}

// ================= فیوژن =================
export interface Fusion {
  id: ID
  projectId: ID
  routeId?: ID
  boxId?: ID
  operationId?: ID
  fiberNumbers: string // شماره تارها (مثلاً "1,2,5-8")
  tubeNumber: string // شماره تیوب
  cableSpec: string // مشخصات کابل
  connectionId: string // شناسه اتصال
  deviceModel: string // مدل دستگاه (اختیاری)
  result: string // نتیجه واقعی ثبت‌شده (دست‌نخورده؛ ساختگی نمایش داده نمی‌شود)
  fusionDate: string // 'YYYY-MM-DD'
  description: string
  createdAt: number
  updatedAt: number
}

// ================= تست توان =================
export type PowerUnit = 'dBm' | 'mW'

export interface PowerTest {
  id: ID
  projectId: ID
  routeId?: ID
  boxId?: ID
  location: string // محل تست
  date: string // 'YYYY-MM-DD'
  value: number // مقدار اندازه‌گیری‌شده (واقعی)
  unit: PowerUnit
  wavelengthNm?: number // طول موج بر حسب nm (اختیاری)
  deviceModel: string // مدل دستگاه
  assigneeProfileId?: ID
  assigneeName: string // اسنپ‌شات
  description: string
  createdAt: number
  updatedAt: number
}

// ================= دراپ‌کابل =================
export type InstallMethod = 'aerial' | 'duct' | 'buried' | 'wall' | 'custom'
export type InstallStatus = 'not_installed' | 'in_progress' | 'installed'
export type DeliveryStatus = 'not_delivered' | 'delivered'

export interface DropCable {
  id: ID
  projectId: ID
  routeId?: ID
  sourceBoxId?: ID // باکس مبدأ
  destination: string // مقصد
  serviceId: string // شناسه سرویس/مشترک (اختیاری)
  address: string
  date: string // 'YYYY-MM-DD'
  executorProfileId?: ID
  executorName: string // اسنپ‌شات مجری
  cableType: string // نوع کابل
  brand: string // برند (اختیاری)
  model: string // مدل (اختیاری)
  coreCount?: number // تعداد کور
  initialMeters?: number // متراژ اولیه
  returnedMeters?: number // متراژ برگشتی
  consumedUser?: number // متراژ مصرفی واردشده توسط کاربر (بدون تغییر باقی می‌ماند)
  consumedAuto?: number // متراژ مصرفی محاسبه‌شده = اولیه − برگشتی (فقط در صورت اعتبار)
  installMethod: InstallMethod
  customMethodLabel: string // روش اجرای سفارشی
  installStatus: InstallStatus
  deliveryStatus: DeliveryStatus
  description: string
  createdAt: number
  updatedAt: number
}

// ================= پروفایل =================
export type ProfileRole =
  | 'contractor'
  | 'network_executor'
  | 'fusion_tech'
  | 'test_tech'
  | 'box_installer'
  | 'drop_executor'
  | 'supervisor'
  | 'inspector'
  | 'custom'

export interface ProfileRoleData {
  contractorArea?: string // محدوده فعالیت پیمانکار
  fusionDevice?: string // مدل دستگاه فیوژن
  testDevice?: string // دستگاه اندازه‌گیری
  dropCableType?: string // نوع کابل دراپ
  dropMethod?: string // روش اجرا
}

export interface Profile {
  id: ID
  firstName: string
  lastName: string
  phone: string // اختیاری
  company: string
  city: string
  description: string
  roles: ProfileRole[]
  customRoleLabel: string // عنوان نقش سفارشی
  roleData: ProfileRoleData
  createdAt: number
  updatedAt: number
}

// ================= عکس =================
export type PhotoCategory =
  | 'project'
  | 'box_install'
  | 'fusion'
  | 'power_test'
  | 'drop_cable'
  | 'delivery'
  | 'other'

export interface PhotoLink {
  projectId?: ID
  routeId?: ID
  boxId?: ID
  operationId?: ID
  fusionId?: ID
  powerTestId?: ID
  dropCableId?: ID
}

export interface Photo extends PhotoLink {
  id: ID
  category: PhotoCategory
  title: string
  description: string
  blob: Blob // اصل عکس (فشرده‌شده) — فضای اختصاصی اپ (IndexedDB)
  thumb: string // تصویر بندانگشتی dataURL برای لیست‌ها (مدیریت حافظه)
  width: number
  height: number
  size: number // بایت
  mime: string
  createdAt: number
}

// ================= تنظیمات =================
export interface SettingEntry {
  key: string
  value: unknown
}

export interface LastBackupInfo {
  time: number // epoch ms
  size: number // بایت
  checksum: string
  counts: Record<string, number>
}

// ================= کمکی =================
export interface ConsumedResult {
  value?: number
  source: 'auto' | 'user' | 'none'
  valid: boolean
  message?: string
}

// مجموعه کلیدهای جدول‌ها برای پشتیبان‌گیری
export const BACKUP_TABLES = [
  'projects',
  'routes',
  'boxes',
  'operations',
  'fusions',
  'powerTests',
  'dropCables',
  'profiles',
  'photos',
] as const

export type BackupTableName = (typeof BACKUP_TABLES)[number]
