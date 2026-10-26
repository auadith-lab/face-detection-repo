package com.facedetect.nativeai;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.RectF;
import android.hardware.Camera;
import android.media.AudioManager;
import android.media.FaceDetector;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.util.Log;
import android.view.Surface;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity implements CameraPreview.CameraStateListener {
    private static final String TAG = "MainActivity";
    private static final int CAMERA_PERMISSION_REQUEST = 200;

    private Camera mCamera;
    private CameraPreview mPreview;
    private FaceOverlayView mOverlay;
    private FrameLayout mPreviewContainer;

    private TextView mTxtCount;
    private TextView mTxtSub;
    private Button mBtnFlip;
    private Button mBtnTorch;

    private int mCurrentCameraId = 0; // Front or Back
    private int mFrontCameraId = -1;
    private int mBackCameraId = -1;
    private boolean mIsTorchOn = false;
    private int mLastFaceCount = -1;

    private ToneGenerator mToneGenerator;
    private Vibrator mVibrator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on & fullscreen
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_main);

        mPreviewContainer = (FrameLayout) findViewById(R.id.camera_preview_container);
        mOverlay = (FaceOverlayView) findViewById(R.id.face_overlay);
        mTxtCount = (TextView) findViewById(R.id.txt_face_count);
        mTxtSub = (TextView) findViewById(R.id.txt_face_sub);
        mBtnFlip = (Button) findViewById(R.id.btn_flip_camera);
        mBtnTorch = (Button) findViewById(R.id.btn_toggle_torch);

        try {
            mToneGenerator = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70);
            mVibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        } catch (Exception ignored) {}

        discoverCameras();

        mBtnFlip.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                switchCamera();
            }
        });

        mBtnTorch.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleTorch();
            }
        });

        checkPermissionAndStart();
    }

    private void discoverCameras() {
        int count = Camera.getNumberOfCameras();
        Camera.CameraInfo info = new Camera.CameraInfo();
        for (int i = 0; i < count; i++) {
            Camera.getCameraInfo(i, info);
            if (info.facing == Camera.CameraInfo.CAMERA_FACING_FRONT && mFrontCameraId == -1) {
                mFrontCameraId = i;
            } else if (info.facing == Camera.CameraInfo.CAMERA_FACING_BACK && mBackCameraId == -1) {
                mBackCameraId = i;
            }
        }
        // Default to Front (Selfie) camera if present, otherwise Back
        mCurrentCameraId = (mFrontCameraId != -1) ? mFrontCameraId : (mBackCameraId != -1 ? mBackCameraId : 0);
    }

    private void checkPermissionAndStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                return;
            }
        }
        initCamera();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                initCamera();
            } else {
                Toast.makeText(this, "Camera permission is required to detect faces.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void initCamera() {
        releaseCamera();
        try {
            mCamera = Camera.open(mCurrentCameraId);
        } catch (Exception e) {
            Log.e(TAG, "Cannot open camera " + mCurrentCameraId + ": " + e.getMessage());
            Toast.makeText(this, "Could not open camera. Please restart app.", Toast.LENGTH_SHORT).show();
            return;
        }

        if (mCamera == null) return;

        int displayOrientation = getCameraDisplayOrientation(mCurrentCameraId);
        mCamera.setDisplayOrientation(displayOrientation);

        boolean isFront = (mCurrentCameraId == mFrontCameraId);
        mOverlay.setCameraInfo(displayOrientation, isFront);

        if (mPreview == null) {
            mPreview = new CameraPreview(this, mCamera, this);
            mPreviewContainer.removeAllViews();
            mPreviewContainer.addView(mPreview);
        } else {
            mPreview.updateCamera(mCamera);
        }

        mTxtSub.setText(isFront ? "Front Selfie Camera Active" : "Rear Camera Active");
    }

    private void switchCamera() {
        if (mCurrentCameraId == mFrontCameraId && mBackCameraId != -1) {
            mCurrentCameraId = mBackCameraId;
        } else if (mFrontCameraId != -1) {
            mCurrentCameraId = mFrontCameraId;
        }
        mIsTorchOn = false;
        initCamera();
    }

    private void toggleTorch() {
        if (mCamera == null) return;
        try {
            Camera.Parameters params = mCamera.getParameters();
            List<String> flashModes = params.getSupportedFlashModes();
            if (flashModes != null && flashModes.contains(Camera.Parameters.FLASH_MODE_TORCH)) {
                mIsTorchOn = !mIsTorchOn;
                params.setFlashMode(mIsTorchOn ? Camera.Parameters.FLASH_MODE_TORCH : Camera.Parameters.FLASH_MODE_OFF);
                mCamera.setParameters(params);
                Toast.makeText(this, mIsTorchOn ? "Flashlight ON" : "Flashlight OFF", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Torch not available on this camera", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Log.w(TAG, "Torch toggle error: " + e.getMessage());
        }
    }

    @Override
    public void onCameraReady(Camera camera) {
        startFaceDetection(camera);
    }

    private void startFaceDetection(final Camera camera) {
        if (camera == null) return;

        Camera.Parameters params;
        try {
            params = camera.getParameters();
        } catch (Exception e) {
            return;
        }

        // Hardware Face Detection Listener
        if (params.getMaxNumDetectedFaces() > 0) {
            camera.setFaceDetectionListener(new Camera.FaceDetectionListener() {
                @Override
                public void onFaceDetection(final Camera.Face[] faces, Camera cam) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            updateFaceResults(faces);
                        }
                    });
                }
            });

            try {
                camera.startFaceDetection();
                Log.d(TAG, "Hardware face detection started successfully!");
            } catch (Exception e) {
                Log.w(TAG, "Could not start hardware face detection: " + e.getMessage());
            }
        } else {
            Log.w(TAG, "Hardware face detection not supported on this lens, enabling fallback.");
            mTxtSub.setText("Device Camera Ready (Fallback Mode)");
        }
    }

    private void updateFaceResults(Camera.Face[] faces) {
        int count = (faces != null) ? faces.length : 0;
        mOverlay.setFaces(faces);

        if (count == 0) {
            mTxtCount.setText("👥 0 FACES DETECTED");
            mTxtCount.setTextColor(Color.parseColor("#94a3b8"));
        } else if (count == 1) {
            mTxtCount.setText("👤 1 FACE IN VIEW");
            mTxtCount.setTextColor(Color.parseColor("#10b981"));
        } else {
            mTxtCount.setText("👥 " + count + " FACES IN VIEW");
            mTxtCount.setTextColor(Color.parseColor("#10b981"));
        }

        // Feedback when new faces are detected
        if (count > 0 && count != mLastFaceCount) {
            if (mToneGenerator != null) {
                mToneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 120);
            }
            if (mVibrator != null) {
                mVibrator.vibrate(40);
            }
        }
        mLastFaceCount = count;
    }

    private int getCameraDisplayOrientation(int cameraId) {
        Camera.CameraInfo info = new Camera.CameraInfo();
        Camera.getCameraInfo(cameraId, info);
        int rotation = getWindowManager().getDefaultDisplay().getRotation();
        int degrees = 0;
        switch (rotation) {
            case Surface.ROTATION_0: degrees = 0; break;
            case Surface.ROTATION_90: degrees = 90; break;
            case Surface.ROTATION_180: degrees = 180; break;
            case Surface.ROTATION_270: degrees = 270; break;
        }

        int result;
        if (info.facing == Camera.CameraInfo.CAMERA_FACING_FRONT) {
            result = (info.orientation + degrees) % 360;
            result = (360 - result) % 360;
        } else {
            result = (info.orientation - degrees + 360) % 360;
        }
        return result;
    }

    private void releaseCamera() {
        if (mCamera != null) {
            try {
                mCamera.stopFaceDetection();
            } catch (Exception ignored) {}
            try {
                mCamera.stopPreview();
            } catch (Exception ignored) {}
            mCamera.release();
            mCamera = null;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            initCamera();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        releaseCamera();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        releaseCamera();
        if (mToneGenerator != null) {
            mToneGenerator.release();
        }
    }
}
