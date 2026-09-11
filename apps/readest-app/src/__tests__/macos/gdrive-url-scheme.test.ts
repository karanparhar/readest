import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Regression guard: the Google Drive OAuth connect on macOS desktop hung forever
 * because the reverse-DNS redirect scheme was never registered on macOS.
 *
 * `tauri-plugin-deep-link`'s `register_all()` is a no-op on macOS (it returns
 * `UnsupportedPlatform` — runtime scheme registration is Windows/Linux only).
 * On Windows/Linux the scheme in `tauri.conf.json` `deep-link.desktop.schemes`
 * is therefore registered at runtime; on iOS the scheme is declared in
 * `Info-ios.plist` `CFBundleURLTypes`. macOS has neither: it relies entirely on
 * the bundled `.app`'s `Info.plist` `CFBundleURLTypes` for Launch Services to
 * route `com.googleusercontent.apps.<id>:/oauthredirect` back to Readest.
 *
 * Without that declaration the OS never delivers the redirect to the app,
 * `RunEvent::Opened` is never emitted, `onOpenUrl` never fires, and the OAuth
 * runner's `awaitRedirectWithFallback` resolves only at its 15-minute deadline
 * — the Connect button spins at "Waiting for sign-in…" indefinitely.
 *
 * This test pins the macOS plist to declare the same Google scheme that is
 * registered for the other platforms, so the connect works on a `tauri build`
 * `.app` bundle.
 */

const GOOGLE_SCHEME_PREFIX = 'com.googleusercontent.apps.';

const tauriConf = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf-8'),
) as {
  plugins: { 'deep-link': { desktop: { schemes: string[] } } };
};

/** The Google reverse-DNS scheme registered for the desktop build. */
const desktopGoogleScheme = tauriConf.plugins['deep-link'].desktop.schemes.find((s) =>
  s.startsWith(GOOGLE_SCHEME_PREFIX),
);

if (!desktopGoogleScheme) {
  throw new Error(
    'Expected a com.googleusercontent.apps.* scheme in tauri.conf.json deep-link.desktop.schemes',
  );
}

const macosPlist = readFileSync(resolve(process.cwd(), 'src-tauri/Info.plist'), 'utf-8');

/**
 * Collect every scheme declared inside a `CFBundleURLSchemes` array in the
 * plist. Plist XML is regular enough that a scoped regex is a robust
 * regression guard without a full plist parser dependency.
 */
const collectUrlSchemes = (xml: string): string[] =>
  [...xml.matchAll(/<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/g)]
    .map((m) => m[1] ?? '')
    .flatMap((block) => [...block.matchAll(/<string>([^<]+)<\/string>/g)].map((s) => s[1] ?? ''));

describe('macOS Info.plist URL scheme registration', () => {
  it('Info.plist declares CFBundleURLTypes', () => {
    // register_all() is unsupported on macOS, so the scheme MUST come from the
    // bundled Info.plist rather than runtime registration.
    expect(macosPlist).toContain('<key>CFBundleURLTypes</key>');
  });

  it('Info.plist registers the Google reverse-DNS redirect scheme', () => {
    const schemes = collectUrlSchemes(macosPlist);
    expect(schemes, 'Info.plist has no CFBundleURLSchemes arrays').not.toEqual([]);
    expect(schemes).toContain(desktopGoogleScheme);
  });

  it('Info.plist registers the readest:// deep-link scheme', () => {
    // readest://book/…, readest://annotation/…, readest://share/… are routed by
    // useOpenBookLink / useOpenAnnotationLink / useOpenShareLink. Same macOS
    // gap as Google Drive: without a CFBundleURLSchemes entry, Launch Services
    // never delivers the URL to the app.
    expect(collectUrlSchemes(macosPlist)).toContain('readest');
  });
});
