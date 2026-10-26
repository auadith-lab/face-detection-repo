package com.facedetect.nativeai;

import android.content.Context;
import android.hardware.Camera;
import android.util.Log;
import android.view.SurfaceHolder;
import android.view.SurfaceView;

import java.io.IOException;
import java.util.List;

public class CameraPreview extends SurfaceView implements SurfaceHolder.Callback {
    private static final String TAG = "CameraPreview";

    private final SurfaceHolder mHolder;
    private Camera mCamera;
    private final CameraStateListener mListener;

    public interface CameraStateListener {
        void onCameraReady(Camera camera);
    }

    public CameraPreview(Context context, Camera camera, CameraStateListener listener) {
        super(context);
        this.mCamera = camera;
        this.mListener = listener;

        mHolder = getHolder();
        mHolder.addCallback(this);
        // Deprecated but required on Android < 3.0
        mHolder.setType(SurfaceHolder.SURFACE_TYPE_PUSH_BUFFERS);
    }

    public void updateCamera(Camera newCamera) {
        this.mCamera = newCamera;
        if (mCamera != null && mHolder.getSurface() != null) {
            try {
                mCamera.stopPreview();
                mCamera.setPreviewDisplay(mHolder);
                mCamera.startPreview();
                if (mListener != null) {
                    mListener.onCameraReady(mCamera);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error switching camera: " + e.getMessage());
            }
        }
    }

    @Override
    public void surfaceCreated(SurfaceHolder holder) {
        if (mCamera == null) return;
        try {
            mCamera.setPreviewDisplay(holder);
            mCamera.startPreview();
            if (mListener != null) {
                mListener.onCameraReady(mCamera);
            }
        } catch (IOException e) {
            Log.e(TAG, "Error setting camera preview: " + e.getMessage());
        }
    }

    @Override
    public void surfaceDestroyed(SurfaceHolder holder) {
        // Handled in Activity
    }

    @Override
    public void surfaceChanged(SurfaceHolder holder, int format, int w, int h) {
        if (mHolder.getSurface() == null || mCamera == null) {
            return;
        }

        try {
            mCamera.stopPreview();
        } catch (Exception ignored) {}

        try {
            Camera.Parameters params = mCamera.getParameters();
            List<String> focusModes = params.getSupportedFocusModes();
            if (focusModes != null) {
                if (focusModes.contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE)) {
                    params.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE);
                } else if (focusModes.contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO)) {
                    params.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO);
                }
            }
            mCamera.setParameters(params);
            mCamera.setPreviewDisplay(mHolder);
            mCamera.startPreview();

            if (mListener != null) {
                mListener.onCameraReady(mCamera);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting camera preview: " + e.getMessage());
        }
    }
}
