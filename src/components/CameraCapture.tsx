import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setShot(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setError("Camera access was blocked. Allow camera permission and try again.");
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

  if (!open) return null;

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1024;
    canvas.height = video.videoHeight || 768;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setShot(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
      <div className="surface w-full max-w-xl rounded-3xl p-5 rise">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Scan your material</h3>
            <p className="text-sm text-muted-foreground">
              Point at a problem, worksheet, or notes — the tutor teaches from it.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close camera">
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-muted">
          {error ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{error}</p>
          ) : shot ? (
            <img src={shot} alt="Captured study material" className="w-full" />
          ) : (
            <video ref={videoRef} playsInline muted className="w-full" />
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {shot ? (
            <>
              <Button variant="outline" onClick={() => setShot(null)}>
                <RefreshCw className="mr-2 size-4" /> Retake
              </Button>
              <Button
                onClick={() => {
                  onCapture(shot);
                  onClose();
                }}
              >
                Teach me this
              </Button>
            </>
          ) : (
            <Button onClick={capture} disabled={!!error}>
              <Camera className="mr-2 size-4" /> Capture
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
