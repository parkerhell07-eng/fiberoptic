import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import './globals.css'

const vazir = localFont({
  src: [
    { path: '../fonts/Vazirmatn-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Vazirmatn-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/Vazirmatn-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/Vazirmatn-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-vazir',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'فیبرکار | مدیریت پروژه‌های فیبر نوری',
  description:
    'اپلیکیشن آفلاین مدیریت پروژه‌ها، مسیرها، باکس‌ها، فیوژن، تست توان و دراپ‌کابل برای تکنسین‌ها و پیمانکاران شبکه فیبر نوری',
  applicationName: 'فیبرکار',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/favicon-32.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'فیبرکار',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#047857',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazir.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        {/* پیام‌ها پایین صفحه (بالای نویگیشن) — جای طبیعی اعلان در اپ موبایل */}
        <Toaster
          dir="rtl"
          position="bottom-center"
          offset="calc(64px + env(safe-area-inset-bottom))"
          mobileOffset="calc(64px + env(safe-area-inset-bottom))"
          richColors
          closeButton
        />
      </body>
    </html>
  )
}
