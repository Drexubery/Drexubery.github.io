# WorldCrafter project page

Static project website. No build step or JavaScript package installation is required.

## Local preview

```sh
python3 serve.py
```

Open http://127.0.0.1:4173/. The preview server supports byte-range requests for video seeking. The same files can be served by a static web host.

## Files

- `index.html`: content and page structure.
- `styles.css`: responsive layout and appearance.
- `main.js`: navigation, NVS selection and playback behavior.
- `gallery.js`: example selection and synchronized reconstruction playback.
- `gallery-data.js`: explicit media mapping for all displayed examples.
- `assets/`: only media, icons and fonts referenced by the current page.

Media filenames use lowercase kebab-case and describe scenes or roles. Experiment dates, source view counts, training settings and playback rates are not encoded in public filenames. Playback metadata remains in the files and gallery configuration. NVS variants use neutral letter suffixes.

## Publishing notes

Generated videos, including NVS outputs, are optimized with H.264 (CRF 21, slow preset) and MP4 fast-start, retaining the original resolution, frame rate, frame count and timeline. The overview retains its CRF 18 version. Point-cloud reconstruction videos use CRF 22 and a square resolution matching the associated generated video's short edge (currently 384×384), with frame rate, frame count and timeline unchanged. Original media and compression reports are stored outside this directory. Gallery videos load on approach or selection; NVS videos load when their panel becomes visible. Only the overview begins loading immediately.

- Publish this directory's contents, not its parent project or cleanup backups.
- Keep the relative directory structure intact.
- The Interactive Demo section currently has introductory text only; its recording has not been supplied.
- Paper, Code, Model Card, Demo and Video resource links are still placeholders. Citation metadata has not been supplied.
- Check the hosting provider's media and repository size limits before upload. Large files may require Git LFS or separate media hosting; confirm that the chosen host serves LFS content.
- Verify distribution rights for supplied media and bundled fonts before public release. Font license documents were not present in the source directory.

The cleanup audit and previous assets are intentionally stored outside this publishable directory.
