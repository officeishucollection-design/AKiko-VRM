# Extension Icons

Place the following PNG icon files in this directory:

| File | Size | Usage |
|------|------|-------|
| `icon16.png` | 16×16 px | Favicon / browser toolbar (small) |
| `icon48.png` | 48×48 px | Extensions management page |
| `icon128.png` | 128×128 px | Chrome Web Store / install dialog |

## Guidelines

- Use a shield or checkmark motif on an indigo (#6366f1) background to match the VRM Companion dark theme.
- PNG format with transparency supported.
- You can generate placeholder icons using any image editor or online tool (e.g., https://favicon.io).

## Quick Placeholder Generation (ImageMagick)

```bash
magick -size 16x16  xc:#6366f1 icons/icon16.png
magick -size 48x48  xc:#6366f1 icons/icon48.png
magick -size 128x128 xc:#6366f1 icons/icon128.png
```

These produce solid indigo squares as minimal valid placeholders so Chrome can load the unpacked extension without errors.
