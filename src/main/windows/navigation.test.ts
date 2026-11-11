import { describe, expect, it } from 'vitest';
import { isNavigationAllowed } from './navigation';

const devServer = 'http://localhost:5173';

describe('isNavigationAllowed', () => {
  it('refuses every navigation in the packaged app', () => {
    expect(isNavigationAllowed('https://example.com/', undefined)).toBe(false);
    expect(isNavigationAllowed('http://localhost:5173/', undefined)).toBe(
      false,
    );
  });

  it('lets the page reload itself from the dev server', () => {
    expect(isNavigationAllowed('http://localhost:5173/', devServer)).toBe(true);
  });

  it('refuses other websites during development', () => {
    expect(isNavigationAllowed('https://example.com/', devServer)).toBe(false);
  });

  it('refuses an address that only looks like the dev server', () => {
    expect(
      isNavigationAllowed('http://localhost.example.com:5173/', devServer),
    ).toBe(false);
  });

  it('refuses a malformed address instead of failing', () => {
    expect(
      isNavigationAllowed('http://localhost:5173.example.com/', devServer),
    ).toBe(false);
  });

  it('refuses another port on the same machine', () => {
    expect(isNavigationAllowed('http://localhost:8080/', devServer)).toBe(
      false,
    );
  });
});
