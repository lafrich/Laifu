package art.lafrich.screenoff;

import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamExtractor;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.RequestBody;

/**
 * Extracts a public YouTube video/audio stream for foreground Media3 playback.
 * Extraction can fail if the provider changes its API or blocks unauthenticated access.
 */
public final class YouTubeResolver {
    private static boolean initialized;
    private YouTubeResolver() { }

    public static final class Result {
        public final String title;
        public final String audioUrl;
        Result(String title, String audioUrl) {
            this.title = title;
            this.audioUrl = audioUrl;
        }
    }

    public static synchronized Result resolve(String youtubeUrl) throws Exception {
        if (!initialized) {
            NewPipe.init(new HttpDownloader());
            initialized = true;
        }

        StreamExtractor extractor = ServiceList.YouTube.getStreamExtractor(youtubeUrl);
        extractor.fetchPage();
        List<AudioStream> streams = extractor.getAudioStreams();
        AudioStream best = null;

        for (AudioStream stream : streams) {
            String uri = stream.getContent();
            if (uri == null || !uri.startsWith("https://")) continue;
            if (best == null) {
                best = stream;
                continue;
            }

            int currentBitrate = stream.getAverageBitrate();
            int bestBitrate = best.getAverageBitrate();
            // Prefer a moderate-quality audio-only stream rather than very high bitrate;
            // all values are kbps as returned by NewPipeExtractor.
            boolean currentPreferred = currentBitrate > 0 && currentBitrate <= 160;
            boolean bestPreferred = bestBitrate > 0 && bestBitrate <= 160;
            if ((currentPreferred && !bestPreferred)
                    || (currentPreferred == bestPreferred && currentBitrate > bestBitrate)) {
                best = stream;
            }
        }

        if (best == null) {
            throw new IOException("Tidak ada stream audio publik yang dapat diputar.");
        }
        return new Result(extractor.getName(), best.getContent());
    }

    /**
     * Match NewPipe's downloader behavior. The previous version sent OkHttp's generic
     * user-agent and forced application/octet-stream on JSON POST requests, which
     * may cause the YouTube API to respond with unparsable content.
     */
    private static final class HttpDownloader extends Downloader {
        private static final String USER_AGENT =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0";
        private final OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .followRedirects(true)
                .build();

        @Override public Response execute(Request request)
                throws IOException, ReCaptchaException {
            String method = request.httpMethod().toUpperCase(java.util.Locale.ROOT);
            byte[] bytes = request.dataToSend();
            RequestBody body = bytes == null ? null : RequestBody.create(bytes);
            if ("POST".equals(method) && body == null) {
                body = RequestBody.create(new byte[0]);
            }
            okhttp3.Request.Builder builder = new okhttp3.Request.Builder()
                    .url(request.url())
                    .method(method, body)
                    .header("User-Agent", USER_AGENT);

            // Preserve headers supplied by NewPipeExtractor, including Content-Type.
            // Using RequestBody.create(data, application/octet-stream) overwrote
            // Content-Type: application/json on YouTube's Innertube POST requests.
            for (Map.Entry<String, List<String>> entry : request.headers().entrySet()) {
                builder.removeHeader(entry.getKey());
                for (String value : entry.getValue()) {
                    builder.addHeader(entry.getKey(), value);
                }
            }

            try (okhttp3.Response response = client.newCall(builder.build()).execute()) {
                if (response.code() == 429) {
                    throw new ReCaptchaException("YouTube meminta verifikasi anti-bot", request.url());
                }
                String responseText = response.body() == null ? "" : response.body().string();
                return new Response(response.code(), response.message(),
                        response.headers().toMultimap(), responseText,
                        response.request().url().toString());
            }
        }
    }
}
