package art.lafrich.saveemall;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;

/** Serializes updates with yt-dlp extraction/downloads. Never updates while downloading. */
public final class EngineManager {
    public static final Object LOCK = new Object();
    private static final String PREF = "save_em_all_engine";
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

    public static void initialize(Context context) throws Exception {
        synchronized (LOCK) {
            YoutubeDL.getInstance().init(context.getApplicationContext());
            FFmpeg.getInstance().init(context.getApplicationContext());
        }
    }

    public static String installedVersion(Context context) {
        String version = YoutubeDL.getInstance().version(context.getApplicationContext());
        return version == null || version.trim().isEmpty() ? "bundled (belum di-update)"
                : version.trim();
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
            SharedPreferences prefs = app.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            long now = System.currentTimeMillis();
            long last = prefs.getLong("last_check", 0L);
            if (!manual && now >= last && (now - last) < INTERVAL_MS) {
                return new Result("Check terakhir dalam 12 jam", true, installedVersion(app));
            }
            prefs.edit().putLong("last_check", now).apply();

            // Nightly gets extractor fixes more frequently than the bundled engine.
            try {
                YoutubeDL.UpdateStatus result = YoutubeDL.getInstance()
                        .updateYoutubeDL(app, YoutubeDL.UpdateChannel._NIGHTLY);
                return new Result(result == YoutubeDL.UpdateStatus.DONE
                        ? "Engine diperbarui (nightly)" : "Engine sudah versi terbaru (nightly)",
                        true, installedVersion(app));
            } catch (Exception nightlyError) {
                Log.w("SaveEmAll", "yt-dlp nightly update failed; trying stable");
            }
            try {
                YoutubeDL.UpdateStatus result = YoutubeDL.getInstance()
                        .updateYoutubeDL(app, YoutubeDL.UpdateChannel._STABLE);
                return new Result(result == YoutubeDL.UpdateStatus.DONE
                        ? "Engine diperbarui (stable)" : "Engine sudah versi terbaru (stable)",
                        true, installedVersion(app));
            } catch (Exception stableError) {
                return new Result("Update gagal: " + ProxySettings.redact(app, stableError.getMessage())
                        + " • Engine lama tetap tersedia", false, installedVersion(app));
            }
        }
    }
}
