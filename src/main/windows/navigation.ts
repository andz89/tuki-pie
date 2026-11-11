// The packaged app has no dev server, so it never navigates anywhere. During
// development the page has to be able to reload itself from the dev server.
export function isNavigationAllowed(
  url: string,
  devServerUrl: string | undefined,
): boolean {
  if (!devServerUrl || !URL.canParse(url)) {
    return false;
  }
  return new URL(url).origin === new URL(devServerUrl).origin;
}
