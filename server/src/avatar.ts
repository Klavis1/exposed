/** ~150KB data-URL payload */
const MAX_AVATAR_CHARS = 200_000;
const MAX_DRAWING_CHARS = 450_000;

function isImageDataUrl(value: string): boolean {
  return (
    (value.startsWith("data:image/jpeg;base64,") ||
      value.startsWith("data:image/jpg;base64,") ||
      value.startsWith("data:image/png;base64,") ||
      value.startsWith("data:image/webp;base64,")) &&
    value.length > 30
  );
}

export function normalizeAvatar(avatar: unknown): string | undefined {
  return normalizeImage(avatar, MAX_AVATAR_CHARS);
}

export function normalizeDrawing(image: unknown): string {
  const value = normalizeImage(image, MAX_DRAWING_CHARS);
  if (!value) {
    throw new Error("Invalid image.");
  }
  return value;
}

function normalizeImage(
  image: unknown,
  maxChars: number
): string | undefined {
  if (image == null || image === "") return undefined;
  if (typeof image !== "string") {
    throw new Error("Invalid image format.");
  }
  if (image.length > maxChars) {
    throw new Error("Image is too large. Try a smaller photo.");
  }
  if (!isImageDataUrl(image)) {
    throw new Error("Invalid image format.");
  }
  return image;
}
