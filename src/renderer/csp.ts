// The Content-Security-Policy each renderer page gets, added to its HTML at
// build time by vite.renderer.config.mts. Scripts only come from the app
// itself, so an injected <script> or inline handler can't run.

export function contentSecurityPolicy(page: string, isDev: boolean): string {
  // No window loads an image from a website: Page Info gets the checked
  // page's images through Chrome, as data. See ChromeImage.tsx.
  const images = "'self' data: blob:";
  const directives = [
    "default-src 'none'",
    // The dev server adds an inline script for React refresh.
    isDev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    // React sets style attributes, and the dev server adds <style> tags.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images}`,
    "font-src 'self' data:",
    // The dev server talks to the page over a WebSocket.
    isDev
      ? "connect-src 'self' ws://localhost:* http://localhost:*"
      : "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "object-src 'none'",
  ];
  return directives.join('; ');
}

// Puts the policy first in <head>, so it applies before anything loads.
export function withContentSecurityPolicy(
  html: string,
  page: string,
  isDev: boolean,
): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(page, isDev)}" />`;
  if (!/<head>/i.test(html)) {
    throw new Error(`${page} has no <head> for its security policy.`);
  }
  return html.replace(/<head>/i, (head) => `${head}\n    ${meta}`);
}
