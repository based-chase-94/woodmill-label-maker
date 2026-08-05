# Woodmill Label Maker

A fully client-side web tool that generates print-ready **2.5" round labels** (Avery
template **5294**, 12-up) for Woodmill grab-and-go items. The client enters an item
name, optional ingredients, and a product number, then downloads a **PDF** (or PNG).
No server, no database — everything runs in the browser.

**Live:** https://based-chase-94.github.io/woodmill-label-maker/

## Using it

1. Enter **Item name**, **Ingredients** (optional), and **Product number**.
2. The live preview updates as you type.
3. Click **Download PDF** (true 2.5") or **Download PNG** (1500 px, 600 DPI).
4. In **Avery Design & Print**, choose template **5294**, and upload the file as the
   label design — Avery tiles the single label across the 12-up sheet.

## Barcode logic

The product number is entered as the **full number including its check digit**. The
tool picks the symbology by **validating that check digit**, not by length (the
client's real products mix formats, and two different items can both be 8 digits):

| Input | Result |
|------|--------|
| 8 digits, valid EAN-8 check | **EAN-8** |
| 12 digits, valid UPC-A check | **UPC-A** |
| 13 digits, valid EAN-13 check | **EAN-13** |
| anything else | **Code 128** (internal codes, e.g. `91847025`) |

The detected symbology is shown under the product-number field. If a number *looks*
like a retail code but its check digit fails, it falls back to Code 128 **and warns**,
so a typo in a real UPC/EAN is noticeable. In every case the *decoded digits* are
identical to the current labels, so the register keeps matching.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
```

A barcode self-test runs on load — open the browser console to see the pass/fail
table for the client's known numbers.

## Build & deploy

Deployed to **GitHub Pages** at https://based-chase-94.github.io/woodmill-label-maker/
via the `based-chase-94` account. Deployment is automatic: the workflow in
`.github/workflows/deploy.yml` builds the site and publishes it on every push to
`main`. To ship a change:

```bash
git add -A && git commit -m "your change" && git push
```

Then watch it go live (~1 min):

```bash
gh run watch --exit-status
```

To build/preview locally without deploying:

```bash
npm run build    # outputs static site to dist/
npm run preview  # serve the built site locally to check it
```

No backend or environment variables required. `vite.config.js` uses a relative base,
so the site works from the Pages subpath (or any other host/subfolder).

> One-time setup note: GitHub Pages had to be enabled once for the repo with the
> source set to "GitHub Actions" (Settings → Pages), because the workflow token can't
> create the Pages site on a brand-new repo. It's done; future pushes just work.

## Tuning the layout

All label proportions live in `DEFAULT_CFG` at the top of `src/label.js` (font sizes,
logo/barcode widths, spacing, the inset ring) — expressed as fractions of the canvas,
so they scale with DPI. Adjust there; the preview reflects changes immediately.

## Assets

- `src/assets/woodmill-logo.svg` — brand logo (vector).
- `src/assets/fonts/Koulen-Regular.ttf` — item-name font (all caps, 4% tracking).
- `src/assets/fonts/Mohave-VariableFont_wght.ttf` — ingredients font (Medium).
- `public/samples/` — the client's original reference mockups (not shipped in build).

## Project location

The working copy lives locally at `~/Developer/woodmill-label-maker` (not inside
Tresorit). This avoids a cloud-sync issue where Tresorit strips the **execute bit**
off `node_modules` binaries and deletes the `.bin` symlinks, which made `vite` fail
with `EACCES` / "command not found".

A **source-only snapshot** (no `node_modules`, no `dist`) is kept in the Tresorit
client folder for delivery/backup. To refresh that snapshot after changes, copy the
source over (everything except `node_modules` and `dist`), e.g.:

```bash
rsync -a --exclude node_modules --exclude dist --exclude .git \
  ~/Developer/woodmill-label-maker/ \
  "/Users/clacroix/Library/CloudStorage/Tresorit-ChaseHawes/Freelance Clients/Woodgrain Bagels/Label Maker/"
```

The `npm run dev` / `npm run build` scripts still call Vite directly and re-`chmod`
esbuild as a belt-and-suspenders safeguard, so they work from anywhere. Deploying the
built `dist/` is unaffected regardless — hosts run `npm install` fresh.
