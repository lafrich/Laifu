package art.lafrich.saveemall;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * yt-dlp engine. A current official yt-dlp nightly is embedded in each APK by
 * CI; first-run migration installs it even without GitHub access on the phone.
 */
public final class EngineManager {
    public static final Object LOCK = new Object();
    private static final String PREF = "save_em_all_engine";
    private static final String BUNDLED_KEY = "installed_bundled_tag";
    private static final String LAST_CHECK_KEY = "last_successful_check";
    private static final long INTERVAL_MS = 12L * 60L * 60L * 1000L;

    private EngineManager() {}

    public static final class Result {
        public final String message;
        public final boolean success;
        public final String version;
        public Result(String message, boolean success, String version) {
            this.message = message;
            this.success = success;
            this.version = version;
        }
    }

    private static SharedPreferences prefs(Context app) {
        return app.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    private static String bundledVersion(Context app) throws IOException {
        try (InputStream input = app.getAssets().open("save_em_all_ytdlp_version.txt")) {
            byte[] bytes = new byte[100];
            int length = input.read(bytes);
            if (length <= 0) throw new IOException("Bundled yt-dlp version missing");
            String value = new String(bytes, 0, length, StandardCharsets.UTF_8).trim();
            if (!value.matches("20[0-9]{2}\\.[0-9]{2}\\.[0-9]{2}(\\.[0-9]{6})?"))
                throw new IOException("Invalid yt-dlp bundle tag: " + value);
            return value;
        }
    }

    public static void initialize(Context context) throws Exception {
        synchronized (LOCK) {
            Context app = context.getApplicationContext();
            YoutubeDL.getInstance().init(app);
            installBundledIfNewer(app);
            FFmpeg.getInstance().init(app);
        }
    }

    private static String verifyRuntimeVersion() throws Exception {
        // Execute the actual bundled Python/yt-dlp runtime, not an estimated
        // version stored in SharedPreferences.
        YoutubeDLRequest request = new YoutubeDLRequest(Collections.<String>emptyList());
        request.addOption("--version");
        YoutubeDLResponse response = YoutubeDL.getInstance().execute(request, null, null);
        String output = response.getOut() == null ? "" : response.getOut().trim();
        if (!output.matches("20[0-9]{2}\\.[0-9]{2}\\.[0-9]{2}(\\.[0-9]{6})?"))
            throw new IOException("yt-dlp cannot start; output: " + output);
        return output;
    }

    private static void installBundledIfNewer(Context app) throws Exception {
        String tag = bundledVersion(app);
        SharedPreferences settings = prefs(app);
        String already = settings.getString(BUNDLED_KEY, "");
        if (tag.equals(already)) return;

        String downloadedVersion = YoutubeDL.getInstance().version(app);
        if (downloadedVersion != null && downloadedVersion.compareTo(tag) >= 0) {
            settings.edit().putString(BUNDLED_KEY, tag).apply();
            return;
        }

        File dir = new File(new File(app.getNoBackupFilesDir(), YoutubeDL.baseName),
                YoutubeDL.ytdlpDirName);
        if (!dir.isDirectory() && !dir.mkdirs())
            throw new IOException("Cannot create yt-dlp directory");
        File installed = new File(dir, YoutubeDL.ytdlpBin);
        File staging = new File(dir, "yt-dlp-bundled.new");
        File backup = new File(dir, "yt-dlp-previous.backup");
        if (staging.exists() && !staging.delete())
            throw new IOException("Cannot clear staging");

        // Application R.raw.ytdlp overrides the older Android library resource.
        try (InputStream input = app.getResources().openRawResource(R.raw.ytdlp);
             FileOutputStream output = new FileOutputStream(staging)) {
            byte[] buffer = new byte[32768];
            int n;
            while ((n = input.read(buffer)) != -1) output.write(buffer, 0, n);
            output.getFD().sync();
        }
        if (staging.length() < 50000) {
            staging.delete();
            throw new IOException("Bundled engine is unexpectedly small");
        }
        if (backup.exists() && !backup.delete()) {
            staging.delete();
            throw new IOException("Cannot clear backup");
        }
        boolean hadPrevious = installed.exists();
        if (hadPrevious && !installed.renameTo(backup)) {
            staging.delete();
            throw new IOException("Cannot back up previous engine");
        }
        if (!staging.renameTo(installed)) {
            if (hadPrevious) backup.renameTo(installed);
            staging.delete();
            throw new IOException("Cannot activate bundled engine");
        }
        try {
            String actual = verifyRuntimeVersion();
            if (!tag.equals(actual))
                throw new IOException("Bundled engine tag differs: " + actual);
            settings.edit().putString(BUNDLED_KEY, tag).apply();
            if (hadPrevious) backup.delete();
            Log.i("SaveEmAll", "Bundled yt-dlp validated: " + tag);
        } catch (Exception e) {
            installed.delete();
            if (hadPrevious) backup.renameTo(installed);
            throw new IOException("New yt-dlp is incompatible; old engine restored", e);
        }
    }

    public static String installedVersion(Context context) {
        Context app = context.getApplicationContext();
        String upstream = YoutubeDL.getInstance().version(app);
        String bundled = prefs(app).getString(BUNDLED_KEY, "");
        if (upstream != null && !upstream.isEmpty()
                && (bundled.isEmpty() || upstream.compareTo(bundled) >= 0))
            return upstream;
        return bundled.isEmpty() ? "bundled engine not initialized" : bundled + " (APK)";
    }

    public static Result update(Context context, boolean manual) {
        Context app = context.getApplicationContext();
        synchronized (LOCK) {
            try {
                initialize(app);
            } catch (Exception e) {
                return new Result("Engine init gagal: " + ProxySettings.redact(app, e.getMessage()),
                        false, installedVersion(app));
            }
            SharedPreferences settings = prefs(app);
            long now = System.currentTimeMillis();
            long last = settings.getLong(LAST_CHECK_KEY, 0L);
            if (!manual && now >= last && now - last < INTERVAL_MS)
                return new Result("Berhasil diperiksa dalam 12 jam terakhir",
                        true, installedVersion(app));

            Exception nightlyError;
            try {
                YoutubeDL.UpdateStatus status = YoutubeDL.getInstance()
                        .updateYoutubeDL(app, YoutubeDL.UpdateChannel._NIGHTLY);
                String actual = verifyRuntimeVersion();
                settings.edit().putLong(LAST_CHECK_KEY, now).apply();
                return new Result((status == YoutubeDL.UpdateStatus.DONE
                        ? "Nightly berhasil di-update: " : "Nightly terbaru: ") + actual,
                        true, actual);
            } catch (Exception e) {
                nightlyError = e;
                Log.w("SaveEmAll", "Nightly update failed, trying stable", e);
            }
            try {
                YoutubeDL.UpdateStatus status = YoutubeDL.getInstance()
                        .updateYoutubeDL(app, YoutubeDL.UpdateChannel._STABLE);
                String actual = verifyRuntimeVersion();
                settings.edit().putLong(LAST_CHECK_KEY, now).apply();
                return new Result((status == YoutubeDL.UpdateStatus.DONE
                        ? "Stable berhasil di-update: " : "Stable terbaru: ") + actual,
                        true, actual);
            } catch (Exception e) {
                Log.w("SaveEmAll", "Stable update failed", e);
                // Do not cache failures as a successful update. Restore the
                // safe bundled version if an update invalidated the runtime.
                settings.edit().remove(BUNDLED_KEY).apply();
                try { installBundledIfNewer(app); }
                catch (Exception recovery) { Log.e("SaveEmAll", "Recovery failed", recovery); }
                String lastMessage = e.getMessage() == null
                        ? nightlyError.getMessage() : e.getMessage();
                return new Result("Update gagal, engine APK dipulihkan. "
                        + ProxySettings.redact(app, lastMessage), false, installedVersion(app));
            }
        }
    }
}
