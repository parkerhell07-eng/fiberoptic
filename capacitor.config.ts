import type { CapacitorConfig } from '@capacitor/cli'

// پیکربندی Capacitor — بسته‌بندی اپ وب فیبرکار به برنامه اندرویدی
const config: CapacitorConfig = {
  appId: 'com.fiberkar.app',
  appName: 'فیبرکار',
  webDir: '.next-cap',
  android: {
    allowMixedContent: false,
    // توجه: captureInput هرگز true نشود — InputConnection ساده‌شده می‌سازد که
    // تایپ فارسی/IME استاندارد اندروید را در WebView خراب می‌کند (باگ فرم‌ها)
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
