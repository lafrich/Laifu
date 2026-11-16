package art.lafrich.saveemall;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import com.yausername.youtubedl_android.YoutubeDLRequest;

import java.net.URI;
import java.util.Locale;

/** User-configured proxy for yt-dlp extraction and transfers, not the embedded WebView. */
public final class ProxySettings {
    private static final String PREFS = "save_em_all_network";
    private static final String KEY = "proxy_url";
    private ProxySettings() {}

    public static String get(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "");
    }

    public static void save(Context context, String value) {
        String valid = validate(value);
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, valid).apply();
    }

    public static String validate(String input) {
        String value = input == null ? "" : input.trim();
        if (value.isEmpty()) return "";
        if (value.length() > 2048 || value.matches(".*\\s+.*"))
            throw new IllegalArgumentException("Proxy URL tidak boleh mengandung spasi.");
        try {
            URI parsed = new URI(value);
            String scheme = parsed.getScheme() == null ? "" : parsed.getScheme().toLowerCase(Locale.ROOT);
            if (!("http".equals(scheme) || "https".equals(scheme) ||
                    "socks4".equals(scheme) || "socks5".equals(scheme) ||
                    "socks5h".equals(scheme))) {
                throw new IllegalArgumentException("Gunakan http://, https:// atau socks5://.");
            }
            if (parsed.getHost() == null || parsed.getHost().isEmpty() || parsed.getPort() < 1
                    || parsed.getPort() > 65535) {
                throw new IllegalArgumentException("Proxy harus memiliki host dan port yang valid.");
            }
            if ((parsed.getRawPath() != null && !parsed.getRawPath().isEmpty())
                    || parsed.getRawQuery() != null || parsed.getRawFragment() != null) {
                throw new IllegalArgumentException("Proxy tidak boleh memiliki path, query atau fragment.");
            }
            return value;
        } catch (java.net.URISyntaxException ex) {
            throw new IllegalArgumentException("Format proxy salah. Contoh: socks5://host:1080");
        }
    }

    public static void apply(Context context, YoutubeDLRequest request) {
        String configured = get(context);
        if (!configured.isEmpty()) request.addOption("--proxy", configured);
    }

    public static String status(Context context) {
        String configured = get(context);
        if (configured.isEmpty()) return "DIRECT CONNECTION";
        try {
            URI uri = new URI(configured);
            return "PROXY ACTIVE • " + uri.getScheme().toUpperCase(Locale.ROOT)
                    + " • " + uri.getHost() + ":" + uri.getPort();
        } catch (Exception e) { return "PROXY ACTIVE"; }
    }

    /** Error strings from yt-dlp may echo proxy credentials; remove the complete URL. */
    public static String redact(Context context, String error) {
        if (error == null) return "Unknown error";
        String proxy = get(context);
        String value = proxy.isEmpty() ? error : error.replace(proxy, "[proxy]");
        return value.length() > 240 ? value.substring(0, 240) : value;
    }
}
