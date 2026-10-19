# فیبرکار — راهنمای ساخت APK اندروید (Capacitor)

فیبرکار یک اپلیکیشن **وب آفلاین‌محور (PWA)** است که داده‌ها را کاملاً روی دستگاه نگه می‌دارد
(IndexedDB). این معماری با WebView اندروید از طریق **Capacitor** به یک APK واقعی تبدیل می‌شود —
بدون هیچ سرور یا اینترنتی.

> ⚠️ در محیط توسعه فعلی (سندباکس) Android SDK و Gradle موجود نیست، بنابراین ساخت APK باید
> یا از طریق **GitHub Actions** (آماده شده در `.github/workflows/build-apk.yml`) یا روی یک
> سیستم با Android Studio انجام شود.

---

## روش ۱ — ساخت خودکار با GitHub Actions (توصیه‌شده)

1. مخزن را روی GitHub قرار دهید (پس از دریافت توکن دسترسی).
2. به تب **Actions** بروید → ورک‌فلو **Build FiberKar Android APK** → **Run workflow**.
   (یا یک تگ `v1.0.0` پوش کنید تا همزمان Release هم ساخته شود.)
3. پس از پایان، از بخش **Artifacts** فایل `fiberkar-debug-apk` را دانلود کنید.
   - `app-debug.apk` — قابل نصب مستقیم برای تست.
   - `app-release-unsigned.apk` — برای انتشار نیازمند امضا (بخش امضا در پایین).

ورک‌فلو شامل این مراحل است: نصب وابستگی‌ها → lint → بیلد استاتیک Next.js
(`CAP_EXPORT=1`) → `cap init/add/sync android` → `gradlew assembleDebug/Release` → آپلود آرتیفکت.

## روش ۲ — ساخت محلی با Android Studio

```bash
# ۱) خروجی استاتیک وب
CAP_EXPORT=1 bun run build          # پوشه out/ ساخته می‌شود

# ۲) نصب Capacitor
bun add -d @capacitor/cli
bun add @capacitor/core @capacitor/android
bunx cap init fiberkar app.fiberkar --web-dir out
bunx cap add android

# ۳) باز کردن پروژه اندروید و بیلد
bunx cap sync android
bunx cap open android   # Android Studio → Build APK
# یا خط فرمان:
cd android && ./gradlew assembleDebug
# خروجی: android/app/build/outputs/apk/debug/app-debug.apk
```

## امضای Release APK

```bash
keytool -genkey -v -keystore fiberkar.keystore -alias fiberkar -keyalg RSA -keysize 2048 -validity 10000
# android/app/build.gradle:
#   signingConfigs { release { storeFile file('fiberkar.keystore'); storePassword '***'; keyAlias 'fiberkar'; keyPassword '***' } }
#   buildTypes { release { signingConfig signingConfigs.release } }
./gradlew assembleRelease
```

## پیش‌نیازهای انتشار در کافه‌بازار / مایکت

- [ ] APK Release امضاشده (بالای ۱۰۰٪ تست نصب/حذف/آپدیت)
- [ ] آیکون ۵۱۲×۵۱۲ + بنر فروشگاه + اسکرین‌شات‌ها (۵ عدد)
- [ ] توضیحات فارسی + دسته‌بندی «ابزارها»
- [ ] صفحه سیاست حفظ حریم خصوصی (داده‌ها فقط روی دستگاه ذخیره می‌شوند — متن آماده در README)
- [ ] تعیین امتیاز سنی و بررسی مجوزها (اپ هیچ مجوز خطرناکی نمی‌خواهد؛ دوربین فقط از WebView File Picker)

## نکات فنی

- `next.config.ts` با متغیر محیطی `CAP_EXPORT=1` به حالت `output: "export"` می‌رود و پوشه `out/` می‌سازد.
- Service Worker و Manifest فقط در بیلد production فعال/معتبرند؛ داخل Capacitor هم WebView آفلاین است.
- شناسه اپ پیشنهادی: `app.fiberkar` — minSdk پیش‌فرض Capacitor (Android 6+) کافی است.
- برای آپدیت‌های آینده تنها کافی است `out/` دوباره ساخته و `bunx cap sync android` اجرا شود.
