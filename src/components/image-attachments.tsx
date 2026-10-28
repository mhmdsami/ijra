"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";

export type PendingImage = { key: string; mime: string; width: number; height: number; data: string };

import { MAX_IMAGES_PER_MESSAGE, splitDataUrl } from "@/lib/images";

const MAX_EDGE = 1600;

async function downscale(file: File): Promise<PendingImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/webp", 0.8);
  return {
    key: crypto.randomUUID(),
    ...splitDataUrl(dataUrl),
    width,
    height,
  };
}

export function useImageQueue() {
  const [images, setImages] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function add(files: File[]) {
    const pictures = files.filter((file) => file.type.startsWith("image/"));
    if (pictures.length === 0) return;
    setError(null);
    const room = MAX_IMAGES_PER_MESSAGE - images.length;
    if (room <= 0) {
      setError(`at most ${MAX_IMAGES_PER_MESSAGE} images per message`);
      return;
    }
    try {
      const next = await Promise.all(pictures.slice(0, room).map(downscale));
      setImages((current) => [...current, ...next].slice(0, MAX_IMAGES_PER_MESSAGE));
    } catch {
      setError("could not read that image");
    }
  }

  return {
    images,
    error,
    add,
    remove: (key: string) => setImages((current) => current.filter((image) => image.key !== key)),
    clear: () => setImages([]),
  };
}

export async function uploadImages(sessionId: string, images: PendingImage[]) {
  const ids: string[] = [];
  for (const image of images) {
    const res = await fetch(`/api/sessions/${sessionId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mime: image.mime, width: image.width, height: image.height, data: image.data }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "could not upload the image");
    }
    ids.push(((await res.json()) as { id: string }).id);
  }
  return ids;
}

export function AttachmentTray({
  images,
  onRemove,
  disabled,
}: {
  images: PendingImage[];
  onRemove: (key: string) => void;
  disabled?: boolean;
}) {
  if (images.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {images.map((image) => (
        <span key={image.key} className="group relative">
          <img
            src={`data:${image.mime};base64,${image.data}`}
            alt=""
            className="size-14 rounded-md border object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(image.key)}
            disabled={disabled}
            className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center rounded-sm border bg-card p-0.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40 max-sm:size-7"
            aria-label="Remove image"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function AttachButton({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
        aria-label="Attach images"
      >
        <ImagePlus className="size-4" />
      </button>
    </>
  );
}
