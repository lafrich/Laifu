package art.lafrich.saveemall;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/** Small, synchronized local queue/history store. No account or remote database. */
public final class Store {
    private static final String PREF = "save_em_all_jobs";
    private static final String KEY = "items";
    private Store() {}

    public static synchronized JSONArray list(Context context) {
        String raw = context.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(KEY, "[]");
        try { return new JSONArray(raw); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    private static void write(Context context, JSONArray items) {
        context.getSharedPreferences(PREF, Context.MODE_PRIVATE)
                .edit().putString(KEY, items.toString()).commit();
    }

    public static synchronized String add(Context context, String url, String mode) {
        String id = String.valueOf(System.currentTimeMillis()) + "-" + String.valueOf((int)(Math.random()*10000));
        try {
            JSONObject item = new JSONObject();
            item.put("id", id);
            item.put("url", url);
            item.put("mode", mode);
            item.put("state", "QUEUED");
            item.put("title", android.net.Uri.parse(url).getHost());
            item.put("detail", "Menunggu giliran");
            item.put("progress", 0);
            item.put("time", System.currentTimeMillis());
            JSONArray previous = list(context);
            JSONArray next = new JSONArray().put(item);
            for (int i = 0; i < Math.min(79, previous.length()); i++) next.put(previous.getJSONObject(i));
            write(context, next);
        } catch (Exception e) { throw new IllegalStateException(e); }
        return id;
    }

    public static synchronized void patch(Context context, String id, String state,
            int progress, String detail, String title, String uri) {
        JSONArray items = list(context);
        try {
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                if (!id.equals(item.optString("id"))) continue;
                if (state != null) item.put("state", state);
                if (progress >= 0) item.put("progress", progress);
                if (detail != null) item.put("detail", detail);
                if (title != null && !title.isEmpty()) item.put("title", title);
                if (uri != null) item.put("uri", uri);
                write(context, items);
                return;
            }
        } catch (Exception ignored) {}
    }

    public static synchronized JSONObject get(Context context, String id) {
        JSONArray items = list(context);
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && id.equals(item.optString("id"))) return item;
        }
        return null;
    }

    public static synchronized JSONObject nextQueued(Context context) {
        JSONArray items = list(context);
        // FIFO: oldest queued item first.
        for (int i = items.length() - 1; i >= 0; i--) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && "QUEUED".equals(item.optString("state"))) return item;
        }
        return null;
    }
}
