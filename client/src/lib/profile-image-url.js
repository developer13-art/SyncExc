export function resolveProfileImageUrl(value, apiBaseUrl, browserOrigin) {
  if (typeof value !== 'string' || !value) return value;

  let imageUrl;
  try {
    imageUrl = new URL(value, browserOrigin);
  } catch {
    return value;
  }

  const match = imageUrl.pathname.match(/\/users\/media\/([^/]+)$/);
  if (!match) return value;

  try {
    const apiBase = new URL(apiBaseUrl || '/', browserOrigin);
    const basePath = apiBase.pathname.replace(/\/+$/, '');
    return new URL(`${basePath}/users/media/${match[1]}`, apiBase.origin).toString();
  } catch {
    return value;
  }
}
