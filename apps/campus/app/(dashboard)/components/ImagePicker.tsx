"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { ImageIcon, Plus, Upload, X } from "lucide-react";
import { Button, Modal } from "@klorad/design-system";
import { uploadFile } from "@klorad/storage/client";
import { STOCK_IMAGES, type StockImage } from "@/lib/stock-images";

interface Props {
  /** Currently-selected image URL (stock or uploaded). */
  value: string | null;
  /** Called when the rector picks a stock image or finishes an upload. */
  onChange: (url: string | null) => void;
  /** Storage prefix for uploaded files — passed straight to
   *  `@klorad/storage`. Use `UPLOAD_PREFIXES.news` etc. */
  uploadPrefix: string;
  /** Default category tab when the modal opens. Picker filters to
   *  this kind first so a dining admin sees food, not megaphones. */
  defaultCategory: StockImage["category"];
  /** Hint copy shown under the field label. */
  hint?: string;
}

/**
 * Two-mode image picker: pick a curated stock SVG, or upload your own.
 *
 * Renders a preview card. When empty, a single "Add image" button
 * opens a modal that defaults to the stock grid filtered to the
 * caller's category — clicking a tile commits and closes. The
 * "Upload" mode swaps in a file input + drop zone wired to the
 * existing storage client.
 *
 * When set, the preview shows the current image plus replace +
 * clear controls. The replace flow re-opens the same modal so a
 * rector can swap stock-for-stock or stock-for-upload without an
 * intermediate "clear" step.
 */
export function ImagePicker({
  value,
  onChange,
  uploadPrefix,
  defaultCategory,
  hint,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-2/40 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="block h-20 w-32 shrink-0 rounded-md object-cover"
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setOpen(true)}
            >
              <ImageIcon size={12} strokeWidth={1.75} aria-hidden />
              Replace
            </Button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-text-tertiary underline-offset-2 hover:text-red-500 hover:underline"
            >
              <X size={11} strokeWidth={1.75} aria-hidden />
              Clear
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-xs text-text-tertiary transition-colors hover:border-accent hover:text-accent"
        >
          <Plus size={14} strokeWidth={1.75} aria-hidden />
          Add image
        </button>
      )}
      {hint ? (
        <p className="text-[11px] text-text-tertiary">{hint}</p>
      ) : null}

      <PickerModal
        open={open}
        defaultCategory={defaultCategory}
        uploadPrefix={uploadPrefix}
        onPick={(url) => {
          onChange(url);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

interface ModalProps {
  open: boolean;
  defaultCategory: StockImage["category"];
  uploadPrefix: string;
  onPick: (url: string) => void;
  onClose: () => void;
}

function PickerModal({
  open,
  defaultCategory,
  uploadPrefix,
  onPick,
  onClose,
}: ModalProps) {
  const [mode, setMode] = useState<"stock" | "upload">("stock");
  const [category, setCategory] = useState<StockImage["category"]>(
    defaultCategory,
  );
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadFile(file, { prefix: uploadPrefix });
      onPick(result.publicUrl);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} title="Pick an image" onClose={onClose}>
      <div className="space-y-4">
        <div className="inline-flex rounded-full bg-surface-2 p-0.5">
          {(["stock", "upload"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={
                mode === m
                  ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-contrast"
                  : "rounded-full px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
              }
            >
              {m === "stock" ? "Stock" : "Upload"}
            </button>
          ))}
        </div>

        {mode === "stock" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(["news", "events", "clubs", "dining"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={
                    category === c
                      ? "rounded-full bg-accent-soft px-3 py-1 text-[11px] font-medium capitalize text-accent"
                      : "rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium capitalize text-text-secondary hover:text-text-primary"
                  }
                >
                  {c}
                </button>
              ))}
            </div>
            <ul className="grid list-none gap-3 sm:grid-cols-3">
              {STOCK_IMAGES.filter((img) => img.category === category).map(
                (img) => (
                  <li key={img.id}>
                    <button
                      type="button"
                      onClick={() => onPick(img.url)}
                      className="group flex w-full flex-col gap-1.5 overflow-hidden rounded-xl border border-line-soft bg-surface-1 text-left transition-colors hover:border-accent"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt=""
                        className="block aspect-[16/9] w-full object-cover"
                      />
                      <span className="px-3 pb-2 text-[11px] font-medium text-text-secondary group-hover:text-text-primary">
                        {img.label}
                      </span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void handleUpload(file);
            }}
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-10 text-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Upload size={18} strokeWidth={1.75} aria-hidden />
            </div>
            <p className="text-sm font-medium text-text-primary">
              Drop an image or pick one
            </p>
            <p className="max-w-xs text-xs text-text-tertiary">
              PNG, JPG or WebP. Roughly 1600 × 900 keeps the card crisp on
              every screen.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={12} strokeWidth={1.75} aria-hidden />
              {uploading ? "Uploading…" : "Choose a file"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
