/**
 * Parses a clinic-supplied metadata URL. Only absolute HTTP(S) URLs without
 * credentials are safe to expose as navigable links.
 */
export function clinicMetadataUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    const url = new URL(value.trim());
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username !== '' ||
      url.password !== ''
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}
