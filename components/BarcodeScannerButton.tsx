"use client";

import { useEffect, useRef, useState } from "react";
import { Barcode, X, Loader2, AlertTriangle } from "lucide-react";

interface BarcodeScannerButtonProps {
  // Called with the decoded text once, then the scanner closes itself.
  onScan: (code: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

// The 1D symbologies stock labels actually use here, plus QR because some
// newer labels carry one. Narrowing the list matters: asking a detector for
// every format it supports makes it slower and more prone to misreads.
const FORMATS = ["code_128", "code_39", "code_93", "ean_13", "ean_8", "itf", "upc_a", "upc_e", "qr_code"];

type Phase = "idle" | "starting" | "scanning" | "error";

/**
 * Mobile-only "Scan" button that reads a serial number off a barcode with the
 * phone camera, for the screens that otherwise expect one to be typed.
 *
 * Why mobile-only (`lg:hidden`): on a desktop these screens are driven by a
 * USB barcode gun, which types into the field directly and needs nothing from
 * us. The camera path exists for field staff on a phone, who have no gun. It
 * also keeps the desktop DOM byte-identical, which is the standing constraint
 * on this whole effort (notes/MOBILE-RESPONSIVE-PLAN.md §6).
 *
 * Two decoders, in order:
 *   1. `BarcodeDetector`, built into Chrome on Android. Native, no download.
 *   2. `@zxing/browser`, imported dynamically only when step 1 is missing -
 *      which in practice means iOS Safari. The dynamic import is the point:
 *      the library never reaches anyone who does not open the scanner.
 *
 * Requires a secure context. localhost counts, a LAN IP does not, so this
 * cannot be exercised by pointing a phone at a dev server - it needs a real
 * HTTPS deployment.
 */
export default function BarcodeScannerButton({
  onScan,
  label = "Scan",
  className = "",
  disabled = false,
}: BarcodeScannerButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  // Guards against a second decode landing while we are already tearing down.
  const doneRef = useRef(false);

  const stopEverything = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      zxingControlsRef.current?.stop();
    } catch {
      /* already stopped */
    }
    zxingControlsRef.current = null;

    // Releasing every track is what actually turns the camera indicator off.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const close = () => {
    stopEverything();
    setPhase("idle");
    setErrorMsg("");
  };

  // Unmounting mid-scan (navigating away with the overlay open) must not leave
  // the camera running.
  useEffect(() => stopEverything, []);

  const handleHit = (raw: string) => {
    const code = (raw || "").trim();
    if (!code || doneRef.current) return;
    doneRef.current = true;
    stopEverything();
    setPhase("idle");
    onScan(code);
  };

  const fail = (msg: string) => {
    stopEverything();
    setErrorMsg(msg);
    setPhase("error");
  };

  const start = async () => {
    doneRef.current = false;
    setErrorMsg("");
    setPhase("starting");

    if (typeof window === "undefined" || !window.isSecureContext) {
      fail("The camera needs a secure (https) connection. Open the site over https and try again.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      fail("This browser does not expose a camera to web pages.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        fail("Camera permission was declined. Allow camera access for this site, then try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        fail("No usable camera was found on this device.");
      } else if (name === "NotReadableError" || name === "AbortError") {
        // Permission was granted but the device could not be opened - almost
        // always another app holding the camera. The browser's own wording for
        // this is "Could not start video source", which tells the user nothing
        // about what to do; hit while testing, hence the specific case.
        fail("The camera is in use by another app, or unavailable. Close anything else using it and try again.");
      } else {
        fail(err?.message || "The camera could not be started.");
      }
      return;
    }

    streamRef.current = stream;
    setPhase("scanning");

    // The overlay only renders once phase is "scanning", so wait a tick for
    // the <video> to exist before wiring the stream into it.
    await new Promise((r) => setTimeout(r, 0));
    const video = videoRef.current;
    if (!video) {
      stopEverything();
      return;
    }

    video.srcObject = stream;
    video.setAttribute("playsinline", "true"); // iOS: otherwise it goes fullscreen
    video.muted = true;
    try {
      await video.play();
    } catch {
      /* Safari can reject an un-awaited play; the frames still arrive */
    }

    const AnyWindow = window as any;
    if (AnyWindow.BarcodeDetector) {
      try {
        const supported: string[] = await AnyWindow.BarcodeDetector.getSupportedFormats();
        const formats = FORMATS.filter((f) => supported.includes(f));
        const detector = new AnyWindow.BarcodeDetector({
          formats: formats.length ? formats : undefined,
        });

        const tick = async () => {
          if (doneRef.current || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            if (found && found.length) {
              handleHit(found[0].rawValue);
              return;
            }
          } catch {
            /* transient decode failure on a blurry frame - keep going */
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return;
      } catch {
        /* fall through to the library below */
      }
    }

    // No native detector (iOS Safari, older Chrome). Pull the library in now,
    // and only now.
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoElement(video, (result: any) => {
        if (result) handleHit(result.getText());
      });
      zxingControlsRef.current = controls as unknown as { stop: () => void };
    } catch (err: any) {
      fail(err?.message || "The barcode reader failed to load.");
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={start}
        className={`lg:hidden h-11 px-4 text-sm font-semibold text-[#00B4D8] bg-[#F0FAFE] hover:bg-[#DFF4FC] disabled:opacity-50 border border-[#00B4D8]/30 rounded-[6px] flex items-center justify-center gap-2 transition-colors shrink-0 ${className}`}
      >
        <Barcode className="w-4 h-4" />
        {label}
      </button>

      {(phase === "starting" || phase === "scanning" || phase === "error") && (
        <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col">
          <div className="flex items-center justify-between px-4 h-14 text-white shrink-0">
            <span className="text-sm font-semibold">Scan barcode</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close scanner"
              className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {phase === "scanning" && (
              <>
                {/* Aiming guide. Purely visual - the decoder reads the whole
                    frame, this just tells people where to hold the label. */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-32 border-2 border-white/80 rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]" />
                <p className="absolute bottom-8 inset-x-0 text-center text-white text-xs px-6">
                  Hold the barcode inside the frame
                </p>
              </>
            )}

            {phase === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center text-white gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Starting camera…</span>
              </div>
            )}

            {phase === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <p className="text-white text-sm">{errorMsg}</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-2 h-11 px-5 rounded-[6px] bg-white/10 hover:bg-white/20 text-white text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
