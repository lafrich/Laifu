package art.lafrich.screenoff;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public final class PlaybackService extends MediaSessionService {
    public static final String ACTION_PLAY_URL = "art.lafrich.screenoff.PLAY_URL";
    public static final String EXTRA_URL = "url";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicInteger generation = new AtomicInteger();
    private ExoPlayer player;
    private MediaSession mediaSession;

    @Override public void onCreate() {
        super.onCreate();
        player = new ExoPlayer.Builder(this).build();
        player.setAudioAttributes(
                new AudioAttributes.Builder()
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                        .setUsage(C.USAGE_MEDIA)
                        .build(), true);
        mediaSession = new MediaSession.Builder(this, player).build();
    }

    @Nullable @Override public MediaSession onGetSession(
            MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_PLAY_URL.equals(intent.getAction())) {
            String link = intent.getStringExtra(EXTRA_URL);
            if (link != null && !link.trim().isEmpty()) {
                int requestId = generation.incrementAndGet();
                worker.execute(() -> resolveAndPlay(link, requestId));
            }
        }
        // Preserve Media3's notification/media-button service lifecycle handling.
        super.onStartCommand(intent, flags, startId);
        return START_NOT_STICKY;
    }

    private void resolveAndPlay(String link, int requestId) {
        try {
            YouTubeResolver.Result stream = YouTubeResolver.resolve(link);
            main.post(() -> {
                if (generation.get() != requestId || player == null) return;
                MediaMetadata metadata = new MediaMetadata.Builder()
                        .setTitle(stream.title)
                        .setArtist("YouTube")
                        .build();
                player.setMediaItem(new MediaItem.Builder()
                        .setUri(stream.audioUrl)
                        .setMediaMetadata(metadata)
                        .build());
                player.prepare();
                player.play();
            });
        } catch (Exception error) {
            Log.e("YouTubeScreenOff", "Cannot resolve YouTube audio", error);
            main.post(() -> {
                if (generation.get() != requestId) return;
                String details = error.getMessage();
                if (details == null || details.trim().isEmpty()) details = "Tidak ada detail tambahan";
                if (details.length() > 140) details = details.substring(0, 140) + "…";
                Toast.makeText(this,
                        "Audio gagal: " + error.getClass().getSimpleName()
                                + " — " + details
                                + ". Coba lagu/video publik lain.",
                        Toast.LENGTH_LONG).show();
            });
        }
    }

    @Override public void onDestroy() {
        generation.incrementAndGet();
        worker.shutdownNow();
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
