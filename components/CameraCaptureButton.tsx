"use client";

import { useRef } from "react";
import { Camera, Video } from "lucide-react";

interface CameraCaptureButtonProps {
  // Receives what the camera returned. Always a single item: `capture`
  // hands back one shot at a time, so callers should append rather than
  // replace whatever the file picker beside this button already collected.
  onCapture: (files: File[]) => void;
  kind?: "photo" | "video";
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Mobile-only "Take Photo" / "Record Video" button, meant to sit *beside* an
 * existing <input type="file"> rather than replace it.
 *
 * Why both, instead of just adding `capture` to the existing input:
 * `accept="image/*"` already offers the camera in the OS chooser on Android
 * and iOS, so the camera was always reachable - just buried under an extra
 * tap. Adding `capture` to that input would launch the camera directly but
 * *remove* the gallery option, which is worse for someone who photographed a
 * receipt earlier in the day. Two controls keeps both paths open.
 *
 * `lg:hidden` is deliberate and load-bearing: desktop browsers largely ignore
 * `capture` and would just show a second, redundant file dialog, and the
 * desktop layout must stay pixel-identical to what shipped (see
 * notes/MOBILE-RESPONSIVE-PLAN.md §6).
 */
export default function CameraCaptureButton({
  onCapture,
  kind = "photo",
  label,
  disabled = false,
  className = "",
}: CameraCaptureButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = kind === "video" ? Video : Camera;
  const text = label ?? (kind === "video" ? "Record Video" : "Take Photo");

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "video" ? "video/*" : "image/*"}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onCapture(files);
          // Reset so shooting the same subject twice still fires onChange -
          // without this the second capture can produce an identical value
          // and the event never fires.
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`lg:hidden h-11 px-4 text-sm font-semibold text-[#00B4D8] bg-[#F0FAFE] hover:bg-[#DFF4FC] disabled:opacity-50 border border-[#00B4D8]/30 rounded-[6px] flex items-center justify-center gap-2 transition-colors ${className}`}
      >
        <Icon className="w-4 h-4" />
        {text}
      </button>
    </>
  );
}
