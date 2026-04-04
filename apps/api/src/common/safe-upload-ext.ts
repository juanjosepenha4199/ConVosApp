/** Extensión de archivo según MIME para guardar en disco. */
export function safeExtFromMime(mime?: string) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'image/heic' || mime === 'image/heif') return '.heic';
  return '.jpg';
}
