import type { CapacitorConfig } from '@capacitor/cli'

// پیکربندی Capacitor — بسته‌بندی اپ وب فیبرکار به برنامه اندرویدی
const config: CapacitorConfig = {
  appId: 'com.fiberkar.app',
  appName: 'فیبرکار',
  webDir: '.next-cap',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
