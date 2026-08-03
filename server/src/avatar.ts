/** ~150KB data-URL payload */
const MAX_AVATAR_CHARS = 200_000;

export function normalizeAvatar(avatar: unknown): string | undefined {
  if (avatar == null || avatar === "") return undefined;
  if (typeof avatar !== "string") {
    throw new Error("Invalid image format.");
  }
  if (avatar.length > MAX_AVATAR_CHARS) {
    throw new Error("Image is too large. Try a smaller photo.");
  }
  const ok =
    (avatar.startsWith("data:image/jpeg;base64,") ||
      avatar.startsWith("data:image/jpg;base64,") ||
      avatar.startsWith("data:image/png;base64,") ||
      avatar.startsWith("data:image/webp;base64,")) &&
    avatar.length > 30;
  if (!ok) {
    throw new Error("Invalid image format.");
  }
  return avatar;
}
