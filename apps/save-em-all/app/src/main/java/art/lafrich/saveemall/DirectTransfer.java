package art.lafrich.saveemall;

import android.net.Uri;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * Downloads explicit media-file URLs without needing a site-specific extractor.
 * This route is only used when no app proxy is configured. HLS/DASH still use yt-dlp.
 */
public final class DirectTransfer {
    private static final String SUFFIXES = ".mp4|.m4v|.mov|.mkv|.webm|.mp3|.m4a|.aac|.wav|.ogg|.opus|.flac|.avi|.3gp|.ts";
    private DirectTransfer() {}

    public interface Progress {
        void update(int percent, String detail) throws Exception;
    }

    public static boolean supports(String url) {
        try {
            String path = Uri.parse(url).getPath();
            if (path == null || path.isEmpty()) return false;
            return path.toLowerCase(Locale.ROOT).matches(".*(" + SUFFIXES.replace(".", "\\.") + ")$");
        } catch (Exception error) { return false; }
    }

    public static File download(String url, File directory, Progress progress) throws Exception {
        if (!supports(url)) throw new IllegalArgumentException("Bukan link file media langsung");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("Folder gagal dibuat");
        String path = Uri.parse(url).getPath();
        String extension = path.substring(path.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        File dest = new File(directory, "media." + extension);

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(45000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Accept", "video/*, audio/*, application/octet-stream, */*");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");

            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("HTTP " + status + " dari server. Periksa link/izin akses.");
            }
            String contentType = connection.getContentType();
            if (contentType != null && (contentType.toLowerCase(Locale.ROOT).contains("text/html")
                    || contentType.toLowerCase(Locale.ROOT).contains("application/json"))) {
                throw new IllegalStateException("Server mengembalikan halaman, bukan file video/audio.");
            }
            long total = connection.getContentLengthLong();
            progress.update(0, "Direct download • connecting");
            try (InputStream in = connection.getInputStream();
                 FileOutputStream out = new FileOutputStream(dest)) {
                byte[] buffer = new byte[65536];
                long downloaded = 0L;
                long lastUpdate = 0L;
                int read;
                while ((read = in.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted())
                        throw new InterruptedException("Download dibatalkan");
                    out.write(buffer, 0, read);
                    downloaded += read;
                    long now = System.currentTimeMillis();
                    if (now - lastUpdate > 900L) {
                        lastUpdate = now;
                        int percent = total > 0 ? (int)Math.min(99L, downloaded * 100L / total) : 0;
                        String detail = total > 0 ? "Direct • " + percent + "%"
                                : "Direct • " + (downloaded / 1024) + " KB";
                        progress.update(percent, detail);
                    }
                }
            }
            if (dest.length() == 0) throw new IllegalStateException("Server mengirim file kosong");
            return dest;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
