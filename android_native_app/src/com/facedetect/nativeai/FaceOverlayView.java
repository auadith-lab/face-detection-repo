package com.facedetect.nativeai;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.hardware.Camera;
import android.util.AttributeSet;
import android.view.View;

import java.util.ArrayList;
import java.util.List;

public class FaceOverlayView extends View {

    private final Paint boxPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint tagBgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint tagTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint landmarkPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

    private Camera.Face[] faces = null;
    private final List<RectF> softwareFaces = new ArrayList<RectF>();
    private int displayOrientation = 90;
    private boolean isFrontCamera = true;
    private final Matrix matrix = new Matrix();

    public FaceOverlayView(Context context) {
        super(context);
        init();
    }

    public FaceOverlayView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        // Vibrant neon emerald bracket lines
        boxPaint.setColor(Color.parseColor("#10b981"));
        boxPaint.setStyle(Paint.Style.STROKE);
        boxPaint.setStrokeWidth(6.0f);
        boxPaint.setStrokeCap(Paint.Cap.ROUND);

        // Translucent inner glow fill
        fillPaint.setColor(Color.parseColor("#1806b6d4"));
        fillPaint.setStyle(Paint.Style.FILL);

        // Tag label background
        tagBgPaint.setColor(Color.parseColor("#e60b1120"));
        tagBgPaint.setStyle(Paint.Style.FILL);

        // Tag label text
        tagTextPaint.setColor(Color.parseColor("#ffffff"));
        tagTextPaint.setTextSize(34.0f);
        tagTextPaint.setFakeBoldText(true);

        // Landmark dots (eyes, mouth)
        landmarkPaint.setColor(Color.parseColor("#38bdf8"));
        landmarkPaint.setStyle(Paint.Style.FILL);
    }

    public void setCameraInfo(int displayOrientation, boolean isFrontCamera) {
        this.displayOrientation = displayOrientation;
        this.isFrontCamera = isFrontCamera;
    }

    public void setFaces(Camera.Face[] detectedFaces) {
        this.faces = detectedFaces;
        this.softwareFaces.clear();
        postInvalidate();
    }

    public void setSoftwareFaces(List<RectF> rects) {
        this.faces = null;
        this.softwareFaces.clear();
        if (rects != null) {
            this.softwareFaces.addAll(rects);
        }
        postInvalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        final int viewWidth = getWidth();
        final int viewHeight = getHeight();
        if (viewWidth == 0 || viewHeight == 0) return;

        // Draw hardware-detected faces (from Camera.FaceDetectionListener)
        if (faces != null && faces.length > 0) {
            // Setup transform matrix from [-1000, 1000] camera space to view pixels
            matrix.reset();
            matrix.setScale(isFrontCamera ? -1f : 1f, 1f);
            matrix.postRotate(displayOrientation);
            matrix.postScale(viewWidth / 2000f, viewHeight / 2000f);
            matrix.postTranslate(viewWidth / 2f, viewHeight / 2f);

            for (int i = 0; i < faces.length; i++) {
                Camera.Face face = faces[i];
                if (face == null) continue;

                RectF rectF = new RectF(face.rect);
                matrix.mapRect(rectF);

                drawTechFaceBox(canvas, rectF, i + 1, face.score > 0 ? face.score : 95);

                // Draw eye landmarks if available
                if (face.leftEye != null) {
                    float[] pt = new float[]{face.leftEye.x, face.leftEye.y};
                    matrix.mapPoints(pt);
                    canvas.drawCircle(pt[0], pt[1], 8f, landmarkPaint);
                }
                if (face.rightEye != null) {
                    float[] pt = new float[]{face.rightEye.x, face.rightEye.y};
                    matrix.mapPoints(pt);
                    canvas.drawCircle(pt[0], pt[1], 8f, landmarkPaint);
                }
                if (face.mouth != null) {
                    float[] pt = new float[]{face.mouth.x, face.mouth.y};
                    matrix.mapPoints(pt);
                    canvas.drawCircle(pt[0], pt[1], 8f, landmarkPaint);
                }
            }
        } 
        // Draw software-detected faces (fallback mode)
        else if (!softwareFaces.isEmpty()) {
            for (int i = 0; i < softwareFaces.size(); i++) {
                RectF rectF = softwareFaces.get(i);
                drawTechFaceBox(canvas, rectF, i + 1, 92);
            }
        }
    }

    private void drawTechFaceBox(Canvas canvas, RectF r, int index, int score) {
        float left = r.left;
        float top = r.top;
        float right = r.right;
        float bottom = r.bottom;

        // Ensure non-inverted bounds
        if (left > right) { float tmp = left; left = right; right = tmp; }
        if (top > bottom) { float tmp = top; top = bottom; bottom = tmp; }

        float width = right - left;
        float height = bottom - top;
        float cornerLen = Math.min(width, height) * 0.25f;

        // Semi-transparent fill
        canvas.drawRect(left, top, right, bottom, fillPaint);

        // Top-Left corner bracket
        canvas.drawLine(left, top + cornerLen, left, top, boxPaint);
        canvas.drawLine(left, top, left + cornerLen, top, boxPaint);

        // Top-Right corner bracket
        canvas.drawLine(right - cornerLen, top, right, top, boxPaint);
        canvas.drawLine(right, top, right, top + cornerLen, boxPaint);

        // Bottom-Right corner bracket
        canvas.drawLine(right, bottom - cornerLen, right, bottom, boxPaint);
        canvas.drawLine(right, bottom, right - cornerLen, bottom, boxPaint);

        // Bottom-Left corner bracket
        canvas.drawLine(left + cornerLen, bottom, left, bottom, boxPaint);
        canvas.drawLine(left, bottom, left, bottom - cornerLen, boxPaint);

        // Floating Tag Badge: "Face #1 · 98%"
        String label = "Face #" + index + " (" + score + "%)";
        float textWidth = tagTextPaint.measureText(label);
        float badgeHeight = 44f;
        float badgeTop = (top > badgeHeight + 10f) ? (top - badgeHeight - 10f) : (top + 10f);
        RectF tagRect = new RectF(left, badgeTop, left + textWidth + 30f, badgeTop + badgeHeight);
        
        canvas.drawRoundRect(tagRect, 12f, 12f, tagBgPaint);
        canvas.drawText(label, left + 14f, badgeTop + 32f, tagTextPaint);
    }
}
