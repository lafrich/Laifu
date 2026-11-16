package art.lafrich.saveemall;

import com.yausername.youtubedl_android.YoutubeDLRequest;

import java.net.URI;
import java.util.Locale;

/**
 * Pornhub page URLs are handled by yt-dlp's existing PornHub extractor.
 * Adds ordinary browser headers only; does not scrape private endpoints,
 * import browser sessions, bypass access restrictions or decrypt DRM.
 */
public final class PornhubSupport {
    private static final String[] DOMAINS = {
            "pornhub.com", "pornhub.net", "pornhub.org", "pornhubpremium.com"
    };
    private static final String USER_AGENT =
            "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

    private PornhubSupport() {}

    public static boolean isSupportedHost(String input) {
        try {
            URI uri = new URI(input);
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    && !"http".equalsIgnoreCase(uri.getScheme())) return false;
            String host = uri.getHost();
            if (host == null) return false;
            host = host.toLowerCase(Locale.ROOT);
            for (String domain : DOMAINS) {
                if (host.equals(domain) || host.endsWith("." + domain)) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    public static void apply(YoutubeDLRequest request, String sourceUrl) {
        if (!isSupportedHost(sourceUrl)) return;
        try {
            URI uri = new URI(sourceUrl);
            String referer = uri.getScheme() + "://" + uri.getHost() + "/";
            request.addOption("--referer", referer);
            request.addOption("--user-agent", USER_AGENT);
            request.addOption("--add-header", "Accept-Language:en-US,en;q=0.9");
        } catch (Exception ignored) {
            // yt-dlp remains responsible for validating the original URL.
        }
    }
}
