# House panorama viewer — revision 146

Requires Node 22.13+ and pnpm. Install with `pnpm install --frozen-lockfile`, then run `pnpm build:public`. Copy `dist-public146/index.public.html` to the published `index.html` and copy `dist-public146/assets/` alongside it. The Vite base path is `/house-panorama/`.

Panoramas are six 1200 × 1200 WebP faces per viewpoint (`f,r,b,l,u,d`). The UI first displays six 320 px previews, then replaces them with the full-resolution images. Room cards use separate 240 px thumbnails. Failed HD loads preserve the preview and offer a retry. Switching rooms cancels old requests; decoded image caching is bounded.

For a future render, use a new panorama directory and update `tour.json` plus the version query in `app/page.tsx`, then rebuild. Keep all six faces of each viewpoint from the same scene revision. `plans/*v146.svg` reflect the revised second-floor cabinet partition and entrance.

GitHub Pages serves this static build directly. No runtime image service or framework server is required. Original lossless render masters and the Blender scene remain in the local project; published WebP files retain 1200 px resolution.
