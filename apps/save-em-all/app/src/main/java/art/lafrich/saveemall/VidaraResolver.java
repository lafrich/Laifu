package art.lafrich.saveemall;

import android.content.Context;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Site-specific resolver for Vidara video hosting. Uses its public player
 * POST /api/stream endpoint; no account API key or DRM bypass.
 *
 * Note: vidara.com (the chemicals company) is NOT this video provider.
 */
public final class VidaraResolver {
    private static final String SITE = "https://vidara.so";
    private static final String USER_AGENT = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    private static final int MAX_RESPONSE = 1024 * 1024;
    private static final String[] HOSTS = {
            "vidara.so", "vidara.to", "viewdara.com", "vidara.fit",
            "vidvara.fit", "vidaraa.cc", "mountainpages.cc"
    };

    private VidaraResolver() {}

    public static final class Result {
        public final String title;
        public final String streamUrl;
        public final String referer;
        public final String filecode;

        private Result(String title, String streamUrl, String referer, String filecode) {
            this.title = title;
            this.streamUrl = streamUrl;
            this.referer = referer;
            this.filecode = filecode;
        }
    }

    public static boolean wrongDomain(String input) {
        try {
            String host = new URI(input).getHost();
            return host != null && (host.equalsIgnoreCase("vidara.com")
                    || host.equalsIgnoreCase("www.vidara.com"));
        } catch (Exception error) { return false; }
    }

    public static boolean isSupportedHost(String input) {
        try {
            URI url = new URI(input);
            if (!"http".equalsIgnoreCase(url.getScheme()) && !"https".equalsIgnoreCase(url.getScheme())) return false;
            String host = url.getHost();
            if (host == null) return false;
            host = host.toLowerCase(Locale.ROOT);
            if (host.startsWith("www.")) host = host.substring(4);
            for (String allowed : HOSTS) {
                if (allowed.equals(host)) return true;
            }
            return false;
        } catch (Exception error) { return false; }
    }

    public static String filecode(String input) {
        if (!isSupportedHost(input)) return null;
        try {
            URI uri = new URI(input);
            String raw = uri.getPath();
            if (raw == null || raw.isEmpty()) return null;
            String[] segments = raw.split("/");
            String code = null;
            if (segments.length == 2) code = segments[1]; // /CODE
            else if (segments.length == 3
                    && ("e".equalsIgnoreCase(segments[1]) || "v".equalsIgnoreCase(segments[1])
                    || "embed".equalsIgnoreCase(segments[1]))) code = segments[2];
            if (code != null && code.startsWith("embed-") && code.endsWith(".html")) {
                code = code.substring(6, code.length() - 5);
            }
            if (code != null && code.matches("[a-zA-Z0-9]{6,32}")) return code;
        } catch (Exception ignored) {}
        return null;
    }

    public static boolean supports(String input) { return filecode(input) != null; }

    public static Result resolve(Context context, String input) throws Exception {
        String code = filecode(input);
        if (code == null) throw new IllegalArgumentException(
                "Link Vidara tidak dikenali. Gunakan URL vidara.so/e/ID atau /v/ID.");
        String proxySetting = ProxySettings.get(context);
        Exception firstError = null;
        for (String endpoint : new String[]{"/api/stream", "/api/stream/master"}) {
            try {
                JSONObject response = requestMaster(code, endpoint, proxySetting);
                String stream = response.optString("streaming_url", "");
                URI mediaUri = new URI(stream);
                if (stream.isEmpty() || !("https".equalsIgnoreCase(mediaUri.getScheme())
                        || "http".equalsIgnoreCase(mediaUri.getScheme())) || mediaUri.getHost() == null) {
                    throw new IllegalStateException("Vidara tidak memberikan streaming_url yang valid");
                }
                String name = response.optString("title", "");
                if (name.isEmpty()) name = "Vidara " + code;
                return new Result(name, stream, SITE + "/e/" + code, code);
            } catch (Exception error) {
                if (firstError == null) firstError = error;
            }
        }
        throw new IllegalStateException("Tidak bisa mengambil stream Vidara: "
                + (firstError == null ? "unknown error" : clean(firstError.getMessage())));
    }

    private static JSONObject requestMaster(String filecode, String endpoint, String proxyUrl) throws Exception {
        URL endpointUrl = new URL(SITE + endpoint);
        HttpURLConnection connection;
        if (proxyUrl.isEmpty()) {
            connection = (HttpURLConnection) endpointUrl.openConnection();
        } else {
            URI proxyUri = new URI(proxyUrl);
            String scheme = proxyUri.getScheme().toLowerCase(Locale.ROOT);
            Proxy.Type type = scheme.startsWith("socks") ? Proxy.Type.SOCKS : Proxy.Type.HTTP;
            Proxy proxy = new Proxy(type, new InetSocketAddress(proxyUri.getHost(), proxyUri.getPort()));
            connection = (HttpURLConnection) endpointUrl.openConnection(proxy);
            if (proxyUri.getRawUserInfo() != null && type == Proxy.Type.HTTP) {
                String credentials = proxyUri.getUserInfo();
                String token = Base64.encodeToString(credentials.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
                connection.setRequestProperty("Proxy-Authorization", "Basic " + token);
            }
        }
        try {
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(18000);
            connection.setDoOutput(true);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/json, */*");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Origin", SITE);
            connection.setRequestProperty("Referer", SITE + "/e/" + filecode);
            connection.setRequestProperty("User-Agent", USER_AGENT);
            connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9");

            JSONObject payload = new JSONObject();
            payload.put("filecode", filecode);
            payload.put("device", "web");
            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream output = connection.getOutputStream()) { output.write(body); }

            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) {
                throw new IllegalStateException("Vidara redirect HTTP " + status);
            }
            if (status != 200) {
                throw new IllegalStateException("Vidara HTTP " + status
                        + (status == 403 ? " (ditolak server; bukan link publik / proteksi situs)" : ""));
            }
            String type = connection.getContentType();
            if (type != null && type.toLowerCase(Locale.ROOT).contains("text/html")) {
                throw new IllegalStateException("Vidara mengirim halaman HTML, bukan respons stream");
            }
            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int n;
                while ((n = input.read(buffer)) != -1) {
                    if (out.size() + n > MAX_RESPONSE) throw new IllegalStateException("Respons Vidara terlalu besar");
                    out.write(buffer, 0, n);
                }
                return new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
            }
        } finally {
            connection.disconnect();
        }
    }

    private static String clean(String text) {
        if (text == null) return "Network error";
        return text.length() <= 200 ? text : text.substring(0, 200);
    }
}
