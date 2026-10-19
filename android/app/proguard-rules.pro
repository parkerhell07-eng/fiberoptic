# FiberKar — قواعد R8/ProGuard برای بیلد Release
# Capacitor پل WebView/JavaScript دارد؛ کلاس‌های پل نباید حذف/تغییرنام شوند.

# کلاس‌های هستهٔ Capacitor (پل JS، پلاگین‌ها، Intent ها)
-keep class com.getcapacitor.** { *; }

# کلاس‌های خود اپ (MainActivity و ...)
-keep class com.fiberkar.app.** { *; }

# پلاگین‌های Capacitor (filesystem / share) — از consumer rules خودشان هم استفاده می‌شود
-keep class com.capacitorjs.plugins.** { *; }

# متدهای @JavascriptInterface هرگز حذف نشوند
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# خطاها با شماره خط خوانا بمانند (تشخیص آسان‌تر مشکل در لاگ‌های کاربران)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
