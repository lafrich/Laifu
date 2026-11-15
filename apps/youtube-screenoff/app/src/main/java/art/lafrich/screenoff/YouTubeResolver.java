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
import okhttp3.MediaType;

public final class YouTubeResolver {
    private static boolean initialized = false;
    private YouTubeResolver() {}

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
        List<AudioStream> audio = extractor.getAudioStreams();
        AudioStream best = null;
        for (AudioStream stream : audio) {
            String url = stream.getContent();
            if (!url.startsWith("https://")) continue;
            // Typical audio streams are 128-160 kbps; prefer best <= 160.
            if (best == null ||
                (stream.getAverageBitrate() > best.getAverageBitrate()
                && stream.getAverageBitrate() <= 160)) {
                best = stream;
            }
        }
        if (best == null) throw new IOException("No playable audio-only stream.");
        return new Result(extractor.getName(), best.getContent());
    }

    private static final class HttpDownloader extends Downloader {
        private final OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(25, TimeUnit.SECONDS)
                .followRedirects(true)
                .build();

        @Override public Response execute(Request request)
                throws IOException, ReCaptchaException {
            okhttp3.Request.Builder builder =
                    new okhttp3.Request.Builder().url(request.url());

            for (Map.Entry<String, List<String>> h : request.headers().entrySet()) {
                for (String value : h.getValue()) builder.addHeader(h.getKey(), value);
            }

            String method = request.httpMethod().toUpperCase(java.util.Locale.ROOT);
            if ("POST".equals(method)) {
                byte[] data = request.dataToSend() == null
                        ? new byte[0] : request.dataToSend();
                builder.post(RequestBody.create(data,
                        MediaType.parse("application/octet-stream")));
            } else if ("HEAD".equals(method)) {
                builder.head();
            } else {
                builder.get();
            }

            try (okhttp3.Response response = client.newCall(builder.build()).execute()) {
                String body = response.body() == null ? "" : response.body().string();
                return new Response(response.code(), response.message(),
                        response.headers().toMultimap(), body,
                        response.request().url().toString());
            }
        }
    }
}
