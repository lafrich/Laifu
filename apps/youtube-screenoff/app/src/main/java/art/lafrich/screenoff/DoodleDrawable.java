package art.lafrich.screenoff;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;

/**
 * Light sketchbook UI element. Two deliberately imperfect ink outlines give
 * buttons and cards a doodle/pen-on-paper look without raster UI screenshots.
 */
public final class DoodleDrawable extends Drawable {
    private final int fill;
    private final int ink;
    private final boolean accent;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
    private int alpha = 255;

    public DoodleDrawable(int fill, int ink, boolean accent) {
        this.fill = fill;
        this.ink = ink;
        this.accent = accent;
    }

    @Override public void draw(Canvas canvas) {
        Rect b = getBounds();
        if (b.isEmpty()) return;
        float density = android.content.res.Resources.getSystem()
                .getDisplayMetrics().density;
        float pad = Math.max(2f, density * 2.1f);
        float x = b.left + pad;
        float y = b.top + pad;
        float w = Math.max(1f, b.width() - pad * 2f);
        float h = Math.max(1f, b.height() - pad * 2f);
        float radius = Math.min(density * 14f, Math.min(w, h) * .28f);

        Path path = outline(x, y, w, h, radius, density);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(fill);
        paint.setAlpha(alpha);
        canvas.drawPath(path, paint);

        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(density * (accent ? 1.65f : 1.45f));
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setColor(ink);
        paint.setAlpha(alpha);
        canvas.drawPath(path, paint);

        // Slightly offset, low-opacity second pen pass.
        canvas.save();
        canvas.translate(density * .8f, -density * .6f);
        paint.setStrokeWidth(density * .75f);
        paint.setAlpha(Math.min(alpha, 85));
        canvas.drawPath(path, paint);
        canvas.restore();

        // Short hand-drawn hatches mimic the user's rough pencil logo.
        if (accent && w > density * 32f && h > density * 26f) {
            paint.setColor(ink);
            paint.setAlpha(Math.min(alpha, 100));
            paint.setStrokeWidth(density * .8f);
            for (int i = 0; i < 3; i++) {
                float xx = x + radius * .5f + i * density * 3.3f;
                float yy = y + density * 2f;
                canvas.drawLine(xx, yy, xx - density * 4.5f,
                        yy + density * 6.7f, paint);
                float rx = x + w - radius - i * density * 3f;
                float ry = y + h - density * 2f;
                canvas.drawLine(rx, ry, rx + density * 5.5f,
                        ry - density * 6.2f, paint);
            }
        }
    }

    private static Path outline(float x, float y, float w, float h, float r, float d) {
        Path p = new Path();
        p.moveTo(x + r, y + d * .6f);
        p.quadTo(x + w * .45f, y - d * .65f, x + w - r, y + d * .5f);
        p.quadTo(x + w + d * .45f, y + d * .8f, x + w - d * .1f, y + r);
        p.quadTo(x + w + d * .6f, y + h * .52f, x + w, y + h - r);
        p.quadTo(x + w - d * .1f, y + h + d * .65f, x + w - r, y + h);
        p.quadTo(x + w * .54f, y + h + d * .85f, x + r, y + h);
        p.quadTo(x - d * .5f, y + h + d * .3f, x, y + h - r);
        p.quadTo(x - d * .65f, y + h * .48f, x, y + r);
        p.quadTo(x + d * .1f, y - d * .5f, x + r, y + d * .6f);
        p.close();
        return p;
    }

    @Override public void setAlpha(int value) {
        alpha = Math.max(0, Math.min(255, value));
        invalidateSelf();
    }

    @Override public void setColorFilter(ColorFilter filter) {
        paint.setColorFilter(filter);
        invalidateSelf();
    }

    @Override public int getOpacity() {
        return PixelFormat.TRANSLUCENT;
    }
}
