// Loads the two brand fonts as real FontFace objects so the <canvas> renderer
// draws with them. Vendored locally (no Google Fonts network call at runtime),
// so rendering is identical on every machine and works offline.
import koulenUrl from './assets/fonts/Koulen-Regular.ttf?url';
import mohaveUrl from './assets/fonts/Mohave-VariableFont_wght.ttf?url';

let loaded = null;

export function loadFonts() {
  if (loaded) return loaded;
  loaded = (async () => {
    const koulen = new FontFace('Koulen', `url(${koulenUrl})`, { weight: '400' });
    // Mohave is a variable font; expose the full weight axis so "500" = Medium.
    const mohave = new FontFace('Mohave', `url(${mohaveUrl})`, { weight: '100 900' });
    await Promise.all([koulen.load(), mohave.load()]);
    document.fonts.add(koulen);
    document.fonts.add(mohave);
    // Warm the exact styles the canvas will request.
    await Promise.all([
      document.fonts.load('400 100px Koulen'),
      document.fonts.load('500 100px Mohave'),
    ]);
    await document.fonts.ready;
  })();
  return loaded;
}
