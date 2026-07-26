export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PUBLIC_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** Folders that may be fetched without a signed URL (public CDN-like paths). */
export const PUBLIC_MEDIA_PREFIXES = ['profiles/', 'public/'] as const;

/** Folders accepted by POST /uploads/public. */
export const PUBLIC_UPLOAD_FOLDERS = [
  'public',
  'age-verification',
  'profiles',
] as const;

export type PublicUploadFolder = (typeof PUBLIC_UPLOAD_FOLDERS)[number];

export const PROFILE_IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function isPublicMediaKey(key: string): boolean {
  return PUBLIC_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function contentTypeForImageFormat(
  format: 'jpeg' | 'png' | 'gif' | 'webp',
): string {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
  }
}
