import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { t } from '../data/translations.js';
import { validatePhotoFile } from '../utils/validation.js';

const PhotoUploader = forwardRef(function PhotoUploader(
  { lang, onFileSelected, onError },
  ref
) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraOpen, setCameraOpen] = useState(false);

  const tr = (key) => t(lang, key);

  useEffect(() => {
    return () => stopStream();
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    e.target.value = '';

    if (!file) return;

    const err = validatePhotoFile(file, tr);

    if (err) {
      onError(err);
      return;
    }

    onFileSelected(file);
  };

  const openCamera = async () => {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      onError(tr('errCameraUnsupported'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (error) {
      console.error('Camera error:', error);
      onError(tr('errCamera'));
    }
  };

  // Expose openCamera() to Home.jsx
  useImperativeHandle(ref, () => ({
    openCamera,
  }));

  const closeCamera = () => {
    stopStream();
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;

    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      onError(tr('errGenerate'));
      return;
    }

    // Mirror selfie exactly like camera preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onError(tr('errGenerate'));
          return;
        }

        const file = new File(
          [blob],
          `selfie-${Date.now()}.jpg`,
          {
            type: 'image/jpeg',
          }
        );

        onFileSelected(file);
        closeCamera();
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div className="photo-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={handleFileChange}
      />

      <div className="uploader-buttons">
        <button
          type="button"
          className="chip-btn"
          onClick={handleGalleryClick}
        >
          <span aria-hidden="true">🖼️</span>
          {tr('gallery')}
        </button>

        <button
          type="button"
          className="chip-btn"
          onClick={openCamera}
        >
          <span aria-hidden="true">📷</span>
          {tr('camera')}
        </button>
      </div>

      {cameraOpen && (
        <div
          className="camera-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="camera-panel">
            <video
              ref={videoRef}
              playsInline
              muted
              className="camera-video"
              style={{
                transform: 'scaleX(-1)',
              }}
            />

            <div className="camera-controls">
              <button
                type="button"
                className="text-btn"
                onClick={closeCamera}
              >
                {tr('close')}
              </button>

              <button
                type="button"
                className="capture-btn"
                onClick={capturePhoto}
                aria-label={tr('camera')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PhotoUploader;