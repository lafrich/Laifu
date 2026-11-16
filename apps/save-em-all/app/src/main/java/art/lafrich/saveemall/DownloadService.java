package art.lafrich.saveemall;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.os.IBinder;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.MimeTypeMap;

import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.mapper.VideoInfo;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import kotlin.Unit;
import kotlin.jvm.functions.Function3;

/** Background serial download queue, using yt-dlp + FFmpeg and public MediaStore Downloads. */
public final class DownloadService extends Service {
    public static final String ADD = "art.lafrich.saveemall.ADD";
    public static final String CANCEL = "art.lafrich.saveemall.CANCEL";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_MODE = "mode";
    public static final String EXTRA_ID = "id";

    private static final int NOTIFICATION = 4801;
    private static final String CHANNEL = "save_em_all_downloads";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean draining = new AtomicBoolean(false);
    private volatile boolean initialized;
    private volatile String runningId;

    @Override public void onCreate() {
        super.onCreate();
        NotificationChannel channel = new NotificationChannel(CHANNEL,
                "Save em all downloads", NotificationManager.IMPORTANCE_LOW);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
        // A killed service may leave a job marked as downloading. Requeue it on restart.
        org.json.JSONArray items = Store.list(this);
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && "DOWNLOADING".equals(item.optString("state"))) {
                Store.patch(this, item.optString("id"), "QUEUED", 0,
                        "Melanjutkan antrean setelah restart", null, null);
            }
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION, notification("Ready", 0));
        if (intent != null && CANCEL.equals(intent.getAction())) {
            String id = intent.getStringExtra(EXTRA_ID);
            if (id != null) {
                Store.patch(this, id, "CANCELLED", -1, "Dibatalkan", null, null);
                if (id.equals(runningId)) {
                    try { YoutubeDL.getInstance().destroyProcessById(id); }
                    catch (Exception e) { Log.w("SaveEmAll", "cancel: " + e.getMessage()); }
                }
            }
        } else if (intent != null && ADD.equals(intent.getAction())) {
            String url = intent.getStringExtra(EXTRA_URL);
            String mode = intent.getStringExtra(EXTRA_MODE);
            String id = intent.getStringExtra(EXTRA_ID);
            if (validUrl(url) && (id == null || Store.get(this, id) == null)) {
                Store.add(this, url, mode == null ? "BEST" : mode);
            }
        }
        drain();
        return START_STICKY;
    }

    public static boolean validUrl(String value) {
        if (value == null || value.length() > 8192) return false;
        try {
            Uri uri = Uri.parse(value.trim());
            String scheme = uri.getScheme();
            return ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))
                    && uri.getHost() != null && !uri.getHost().isEmpty();
        } catch (Exception e) { return false; }
    }

    private void drain() {
        if (!draining.compareAndSet(false, true)) return;
        executor.execute(() -> {
            try {
                JSONObject item;
                while ((item = Store.nextQueued(this)) != null) process(item);
            } finally {
                draining.set(false);
                if (Store.nextQueued(this) != null) {
                    drain();
                } else {
                    stopForeground(STOP_FOREGROUND_REMOVE);
                    stopSelf();
                }
            }
        });
    }

    private void initEngine() throws Exception {
        if (initialized) return;
        EngineManager.initialize(this);
        initialized = true;
    }

    private void process(JSONObject job) {
        String id = job.optString("id");
        String url = job.optString("url");
        String mode = job.optString("mode", "BEST");
        String title = job.optString("title", "Media");
        String effectiveUrl = url;
        VidaraResolver.Result vidara = null;
        File stage = null;
        runningId = id;
        try {
            Store.patch(this, id, "DOWNLOADING", 0, "Menghubungkan ke sumber video...", null, null);
            postNotification("Connecting to media source", 0);

            // Direct MP4/MP3/etc URLs are ordinary HTTP resources, not website pages.
            // Prefer simple HTTP streaming so these work even if yt-dlp's extractor is outdated.
            if (ProxySettings.get(this).isEmpty() && DirectTransfer.supports(url) && !"AUDIO".equals(mode)) {
                File base = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (base == null) base = getCacheDir();
                stage = new File(base, "staging/" + id);
                File result = DirectTransfer.download(url, stage, (percent, detail) -> {
                    if ("CANCELLED".equals(state(id))) throw new InterruptedException("Cancelled");
                    Store.patch(this, id, null, percent, detail, null, null);
                    postNotification("Direct download " + percent + "%", percent);
                });
                if ("CANCELLED".equals(state(id))) return;
                String exported = exportMedia(result, title);
                Store.patch(this, id, "DONE", 100, "Saved in Downloads/Save em all", title, exported);
                postNotification("Saved: " + trim(title, 32), 100);
                return;
            }

            // Vidara is not a normal yt-dlp page extractor: its player resolves an
            // HLS manifest via a public POST /api/stream call with a filecode.
            if (VidaraResolver.wrongDomain(url)) {
                throw new IllegalArgumentException("vidara.com bukan situs video. Coba link dari vidara.so atau viewdara.com.");
            }
            if (VidaraResolver.isSupportedHost(url)) {
                Store.patch(this, id, null, 0, "VIDARA • Mencari filecode dan HLS stream...", null, null);
                vidara = VidaraResolver.resolve(this, url);
                effectiveUrl = vidara.streamUrl;
                title = vidara.title;
                Store.patch(this, id, null, 1, "VIDARA • Stream ditemukan; memulai download...", title, null);
            }

            synchronized (EngineManager.LOCK) {
            Store.patch(this, id, null, 0, "Memulai yt-dlp, menyiapkan stream...", null, null);
            initEngine();

            // Metadata failures should not prevent direct media URLs from downloading.
            if (vidara == null) try {
                YoutubeDLRequest inspect = new YoutubeDLRequest(url);
                ProxySettings.apply(this, inspect);
                VideoInfo info = YoutubeDL.getInstance().getInfo(inspect);
                if (info != null && info.getTitle() != null && !info.getTitle().isEmpty()) {
                    title = info.getTitle();
                    Store.patch(this, id, null, -1, null, title, null);
                }
            } catch (Exception ignored) {}

            File base = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (base == null) base = getCacheDir();
            stage = new File(base, "staging/" + id);
            if (!stage.isDirectory() && !stage.mkdirs()) throw new IllegalStateException("Tidak bisa membuat folder sementara");

            YoutubeDLRequest request = new YoutubeDLRequest(effectiveUrl);
            ProxySettings.apply(this, request);
            if (vidara != null) {
                request.addOption("--referer", vidara.referer);
                request.addOption("--add-header", "Origin:https://vidara.so");
                request.addOption("--user-agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36");
            }
            request.addOption("--no-playlist");
            request.addOption("--no-mtime");
            request.addOption("--socket-timeout", "20");
            request.addOption("--retries", "3");
            request.addOption("--fragment-retries", "3");
            request.addOption("-o", new File(stage, "media.%(ext)s").getAbsolutePath());
            if ("AUDIO".equals(mode)) {
                request.addOption("-x");
                request.addOption("--audio-format", "mp3");
                request.addOption("--audio-quality", "0");
            } else if (vidara != null) {
                if ("720P".equals(mode)) {
                    request.addOption("-f", "b[height<=720]/best[height<=720]/best");
                } else {
                    request.addOption("-f", "b/bv*+ba");
                }
                request.addOption("--merge-output-format", "mp4");
            } else if ("720P".equals(mode)) {
                request.addOption("-f", "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/b");
                request.addOption("--merge-output-format", "mp4");
            } else if ("ORIGINAL".equals(mode)) {
                request.addOption("-f", "b/bv*+ba");
            } else {
                request.addOption("-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b");
                request.addOption("--merge-output-format", "mp4");
            }

            final int[] lastProgress = {-1};
            final long[] lastTick = {0L};
            Function3<Float, Long, String, Unit> callback = (progress, eta, line) -> {
                int p = Math.max(0, Math.min(99, Math.round(progress)));
                long now = System.currentTimeMillis();
                if (p >= lastProgress[0] + 2 || now - lastTick[0] > 2000) {
                    lastProgress[0] = p;
                    lastTick[0] = now;
                    if (!"CANCELLED".equals(state(id))) {
                        Store.patch(this, id, null, p, line == null ? "Downloading" : trim(line, 160), null, null);
                        postNotification("Downloading " + p + "%", p);
                    }
                }
                return Unit.INSTANCE;
            };
            try {
                YoutubeDL.getInstance().execute(request, id, callback);
            } catch (Exception formatError) {
                String message = formatError.getMessage() == null ? "" : formatError.getMessage().toLowerCase(Locale.ROOT);
                // Some sources have no MP4/M4A representation. Retry with yt-dlp's
                // native best format only when the selected format truly does not exist.
                if (vidara == null && "BEST".equals(mode) && (message.contains("requested format is not available")
                        || message.contains("requested format not available"))) {
                    Store.patch(this, id, null, 0, "Trying alternate video format...", null, null);
                    YoutubeDLRequest retry = new YoutubeDLRequest(url);
                    ProxySettings.apply(this, retry);
                    retry.addOption("--no-playlist");
                    retry.addOption("--no-mtime");
                    retry.addOption("--socket-timeout", "20");
                    retry.addOption("-o", new File(stage, "media.%(ext)s").getAbsolutePath());
                    retry.addOption("-f", "bv*+ba/b");
                    YoutubeDL.getInstance().execute(retry, id, callback);
                } else throw formatError;
            }
            } // engine lock: updater must not replace yt-dlp during a download.
            if ("CANCELLED".equals(state(id))) return;

            File result = findResult(stage);
            if (result == null) throw new IllegalStateException("Stream selesai tanpa file output");
            String exported = exportMedia(result, title);
            Store.patch(this, id, "DONE", 100, "Saved in Downloads/Save em all", title, exported);
            postNotification("Saved: " + trim(title, 32), 100);
        } catch (Exception e) {
            if (!"CANCELLED".equals(state(id))) {
                Store.patch(this, id, "FAILED", -1,
                        readableError(e), null, null);
                postNotification("Download failed", 0);
            }
            Log.e("SaveEmAll", "Download failed: " + e.getClass().getSimpleName());
        } finally {
            if (stage != null) clean(stage);
            runningId = null;
        }
    }

    private String readableError(Exception e) {
        String raw = ProxySettings.redact(this, e.getMessage() == null ? e.toString() : e.getMessage());
        String m = raw.toLowerCase(Locale.ROOT);
        String advice;
        if (m.contains("403") || m.contains("forbidden")) advice = "HTTP 403 • Link kedaluwarsa, cookies, atau akses ditolak. ";
        else if (m.contains("404")) advice = "HTTP 404 • File/link tidak ditemukan. ";
        else if (m.contains("requested format")) advice = "Format tidak tersedia • Coba SOURCE atau MP3. ";
        else if (m.contains("sign in") || m.contains("login") || m.contains("cookies")) advice = "Perlu login/cookies; sumber mungkin tidak didukung. ";
        else if (m.contains("vidara") && m.contains("http 403")) advice = "Vidara membatasi akses stream. Pastikan link publik dan dapat diputar. ";
        else if (m.contains("unsupported url") || m.contains("no video formats")) advice = "Situs belum didukung atau bukan link video. ";
        else if (m.contains("proxy")) advice = "Masalah proxy • Coba DIRECT / RESET. ";
        else advice = "Download gagal • Periksa link dan jaringan. ";
        return trim(advice + raw, 500);
    }

    private String state(String id) {
        JSONObject obj = Store.get(this, id);
        return obj == null ? "" : obj.optString("state");
    }

    private File findResult(File dir) {
        File[] files = dir.listFiles();
        if (files == null) return null;
        File best = null;
        for (File file : files) {
            if (!file.isFile()) continue;
            String n = file.getName().toLowerCase(Locale.ROOT);
            if (n.endsWith(".part") || n.endsWith(".ytdl") || n.endsWith(".json")
                    || n.endsWith(".jpg") || n.endsWith(".webp") || n.endsWith(".txt")) continue;
            if (best == null || file.length() > best.length()) best = file;
        }
        return best;
    }

    private String exportMedia(File file, String title) throws Exception {
        String filename = file.getName();
        String ext = filename.contains(".") ? filename.substring(filename.lastIndexOf('.') + 1) : "bin";
        String displayName = cleanName(title) + "." + ext.toLowerCase(Locale.ROOT);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase(Locale.ROOT));
        if (mime == null) mime = "application/octet-stream";
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Save em all");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("MediaStore tidak tersedia");
        boolean success = false;
        try {
            try (InputStream input = new FileInputStream(file);
                 OutputStream output = getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("Tidak bisa menyimpan ke Downloads");
                byte[] buffer = new byte[65536];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            }
            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            getContentResolver().update(uri, values, null, null);
            success = true;
            return uri.toString();
        } finally {
            if (!success) getContentResolver().delete(uri, null, null);
        }
    }

    private static String cleanName(String name) {
        String safe = (name == null ? "media" : name).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (safe.isEmpty()) safe = "media";
        return trim(safe, 92);
    }

    private static String trim(String value, int max) {
        return value == null ? "" : value.length() <= max ? value : value.substring(0, max);
    }

    private void clean(File path) {
        if (path.isDirectory()) {
            File[] children = path.listFiles();
            if (children != null) for (File child : children) clean(child);
        }
        // best effort; app owns these staging files.
        path.delete();
    }

    private Notification notification(String text, int progress) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = new Notification.Builder(this, CHANNEL)
                .setContentTitle("SAVE EM ALL")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentIntent(pending)
                .setOnlyAlertOnce(true)
                .setOngoing(true);
        if (progress > 0 && progress < 100) builder.setProgress(100, progress, false);
        return builder.build();
    }

    private void postNotification(String text, int progress) {
        getSystemService(NotificationManager.class).notify(NOTIFICATION, notification(text, progress));
    }

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() {
        executor.shutdown();
        super.onDestroy();
    }
}
