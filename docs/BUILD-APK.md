# فیبرکار — راهنمای ساخت APK اندروید (Capacitor)

فیبرکار یک اپلیکیشن **وب آفلاین‌محور (PWA)** است که داده‌ها را کاملاً روی دستگاه نگه می‌دارد
(IndexedDB). این معماری با WebView اندروید از طریق **Capacitor 8** به یک APK واقعی تبدیل می‌شود —
بدون هیچ سرور یا اینترنتی.

> ✅ این فرآیند **واقعاً اجرا و تست شده است**: APK امضاشده نسخه ۱٫۰ با موفقیت ساخته شد
> (package: `com.fiberkar.app` — minSdk 24 / Android 7+ — targetSdk 36 — حجم ۵٫۲ مگابایت —
> تنها مجوز: INTERNET).

---

## روش ۱ — ساخت خودکار با GitHub Actions (نیازمند یک‌بار فعال‌سازی)

فایل ورک‌فلو در مخزن موجود است: [`docs/ci/build-apk.yml`](../docs/ci/build-apk.yml).
چون توکن فعلی مجوز `Workflows` ندارد، برای فعال‌سازی CI یکی از دو راه زیر:

**الف) از طریق وب (ساده‌ترین):**
1. در GitHub به `Add file → Create new file` بروید و مسیر `.github/workflows/build-apk.yml` را بسازید
2. محتوای `docs/ci/build-apk.yml` را کپی و Paste کنید → Commit
3. تب Actions → ورک‌فلو **Build FiberKar Android APK** → Run workflow (یا پوش تگ `v*` → Release خودکار)

**ب) با توکن دارای مجوز:** توکن Fine-grained با مجوزهای `Contents` + `Workflows` (Read & write) بسازید؛
سپس کافی است `cp docs/ci/build-apk.yml .github/workflows/build-apk.yml && git add . && git push`.

پس از پایان اجرا، از بخش **Artifacts** فایل APK را دانلود کنید:
- `fiberkar-debug-apk` → `app-debug.apk` — قابل نصب مستقیم برای تست
- `fiberkar-release-apk-signed` → فقط اگر Secretهای امضا تنظیم شده باشند

ورک‌فلو شامل این مراحل است: نصب وابستگی‌ها → lint → بیلد استاتیک Next.js
(`bun run build:cap`) → `bunx cap sync android` → `gradlew assembleDebug/Release` →
امضای اختیاری با Secretها → آپلود آرتیفکت / Release.

> ℹ️ توجه: Release نسخه ۱٫۰ از قبل با APK **امضاشده محلی** منتشر شده است:
> <https://github.com/parkerhell07-eng/fiberoptic/releases/tag/v1.0>

### امضای خودکار در CI (اختیاری)

این Secretها را در تنظیمات مخزن (Settings → Secrets and variables → Actions) اضافه کنید:

| Secret | توضیح |
|---|---|
| `FIBERKAR_KEYSTORE_B64` | فایل keystore به‌صورت base64: `base64 -w0 fiberkar.keystore` |
| `FIBERKAR_KEYSTORE_PASSWORD` | رمز keystore |
| `FIBERKAR_KEY_ALIAS` | نام alias (مثلاً `fiberkar`) |
| `FIBERKAR_KEY_PASSWORD` | رمز کلید |

> ⚠️ فایل keystore هرگز نباید داخل مخزن قرار گیرد — فقط از طریق Secret.

## روش ۲ — ساخت محلی (خط فرمان — تست‌شده)

پیش‌نیازها: JDK 21 کامل (javac دارد)، Android SDK (platform 36 + build-tools 36.0.0)، Bun.

```bash
# ۱) خروجی استاتیک وب (در پوشه .next-cap ساخته می‌شود — dev server را مختل نمی‌کند)
bun run build:cap

# ۲) سینک وب‌اپ داخل پروژه اندروید (پوشه android/ از قبل در مخزن است)
bunx cap sync android

# ۳) بیلد APK
cd android
./gradlew assembleDebug          # خروجی: app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease        # خروجی: app/build/outputs/apk/release/app-release-unsigned.apk
```

اگر پوشه `android/` را حذف کرده‌اید، یک‌بار `bunx cap add android` اجرا کنید.

## روش ۳ — ساخت با Android Studio

`bun run build:cap` → `bunx cap sync android` → `bunx cap open android` → Build → Build APK(s).

## امضای Release APK (روش zipalign + apksigner — تست‌شده)

```bash
# ساخت keystore (فقط یک‌بار — این فایل را برای همیشه نگه دارید!)
keytool -genkeypair -keystore fiberkar-release.keystore -alias fiberkar \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=FiberKar, O=FiberKar, L=Tehran, C=IR"

# هم‌ترازی و امضا
BT=$ANDROID_HOME/build-tools/36.0.0
$BT/zipalign -p -f 4 app-release-unsigned.apk fiberkar-aligned.apk
$BT/apksigner sign --ks fiberkar-release.keystore --ks-key-alias fiberkar \
  --out fiberkar-v1.0-release.apk fiberkar-aligned.apk
$BT/apksigner verify --print-certs fiberkar-v1.0-release.apk
```

> ⚠️ keystore و رمزهای آن را در جای امن نگه دارید؛ بدون آن امکان انتشار آپدیت با همان امضا وجود ندارد.
> ⚠️ فایل keystore هرگز نباید به مخزن گیت یا logs وارد شود.

## پیش‌نیازهای انتشار در کافه‌بازار / مایکت

- [ ] APK Release امضاشده (بالای ۱۰۰٪ تست نصب/حذف/آپدیت)
- [ ] آیکون ۵۱۲×۵۱۲ (موجود: `public/icons/icon-512.png`) + بنر فروشگاه + اسکرین‌شات‌ها
- [ ] توضیحات فارسی + دسته‌بندی «ابزارها»
- [ ] صفحه سیاست حفظ حریم خصوصی (داده‌ها فقط روی دستگاه ذخیره می‌شوند — متن آماده در README)
- [ ] تعیین امتیاز سنی و بررسی مجوزها (اپ فقط مجوز INTERNET دارد؛ دوربین از File Picker اندروید)

## نکات فنی

- `next.config.ts` با متغیر محیطی `CAP_EXPORT=1` به حالت `output: "export"` می‌رود؛ با
  `NEXT_DIST_DIR=.next-cap` خروجی در همان پوشه ساخته می‌شود (webDir در `capacitor.config.ts`).
- ساخت عادی (`bun run build`) دست‌نخورده است و برای استقرار وب/سرور standalone استفاده می‌شود.
- داخل APK، اشتراک‌گذاری PDF و ذخیره پشتیبان از **پلاگین‌های بومی Capacitor**
  (`@capacitor/share` + `@capacitor/filesystem`) استفاده می‌کنند (پل: `src/lib/native-bridge.ts`)؛
  در وب همان رفتار قبلی (Web Share API / File Picker) حفظ شده است.
- شناسه اپ: `com.fiberkar.app` — minSdk 24 (Android 7+)، targetSdk 36.
- آیکون‌های لانچر و اسپلش با `bunx @capacitor/assets generate --android` از پوشه `assets/` تولید می‌شوند.
- برای آپدیت‌های آینده: `bun run build:cap` → `bunx cap sync android` → `./gradlew assembleRelease`.
