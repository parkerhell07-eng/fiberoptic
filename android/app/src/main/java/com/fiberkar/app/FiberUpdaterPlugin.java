package com.fiberkar.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * پلاگین به‌روزرسانی درون‌برنامه‌ای فیبرکار (v1.3)
 *  - getVersion: نسخهٔ نصب‌شده از BuildConfig (بدون نگهداری دستی در JS)
 *  - downloadApk: دانلود APK آخرین Release گیت‌هاب به Cache اپ + رویداد پیشرفت
 *  - installApk: باز کردن نصب‌کنندهٔ اندروید روی فایل دانلودشده (FileProvider)
 * کلید امضا یکی است → به‌روزرسانی درجا با حفظ کامل داده‌ها؛ صحت بسته هم توسط
 * PackageManager در زمان نصب با امضای v2/v3 تأیید می‌شود.
 */
@CapacitorPlugin(name = "FiberUpdater")
public class FiberUpdaterPlugin extends Plugin {

    @PluginMethod
    public void getVersion(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("version", BuildConfig.VERSION_NAME);
        ret.put("versionCode", BuildConfig.VERSION_CODE);
        call.resolve(ret);
    }

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("نشانی فایل به‌روزرسانی خالی است");
            return;
        }
        try {
            Context ctx = getContext();
            File dir = new File(ctx.getCacheDir(), "update");
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, "fiberkar-update.apk");
            // فایل ناقص یا قدیمی قبلی پاک شود
            if (out.exists()) out.delete();

            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setInstanceFollowRedirects(true);
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                conn.disconnect();
                call.reject("دانلود ناموفق بود (کد " + code + ")");
                return;
            }
            long total = conn.getContentLengthLong();
            long done = 0;
            int lastPercent = -1;
            InputStream in = conn.getInputStream();
            FileOutputStream fos = new FileOutputStream(out);
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                fos.write(buf, 0, n);
                done += n;
                if (total > 0) {
                    int percent = (int) (done * 100 / total);
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject p = new JSObject();
                        p.put("percent", percent);
                        p.put("done", done);
                        p.put("total", total);
                        notifyListeners("progress", p);
                    }
                }
            }
            fos.flush();
            fos.close();
            in.close();
            conn.disconnect();

            JSObject ret = new JSObject();
            ret.put("path", out.getAbsolutePath());
            ret.put("size", out.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("دانلود به‌روزرسانی ناموفق بود: " + e.getMessage());
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("مسیر فایل به‌روزرسانی خالی است");
            return;
        }
        try {
            Context ctx = getContext();
            File f = new File(path);
            if (!f.exists()) {
                call.reject("فایل به‌روزرسانی یافت نشد");
                return;
            }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("باز کردن نصب‌کنندهٔ اندروید ناموفق بود: " + e.getMessage());
        }
    }
}
