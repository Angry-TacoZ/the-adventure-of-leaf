# Asset and dependency credits

Prototype geometry, materials and code were created for this project with AI assistance; the riverbed uses a third-party texture. After Rain is all rights reserved and is only a visual reference. See WATER_TECH_EVALUATION.md for reference licenses; none of their source or assets was copied.

Direct runtime dependencies: [Three.js](https://github.com/mrdoob/three.js), MIT; [lil-gui](https://github.com/georgealways/lil-gui), MIT (development panel only). Direct development tools: TypeScript, Apache-2.0; Vite, MIT; Playwright, Apache-2.0; @types/three, MIT. Exact versions and transitive dependencies are recorded in package-lock.json. Audit the actual distributed dependency tree and notices before release.

Reflection/refraction uses the MIT-licensed Three.js Reflector and Refractor addons bundled with three 0.186.1; their copyright/license notices remain in the dependency. The Fresnel/Snell combination shader was authored in this project with AI assistance. Evan Wallace demo/article are technical and visual references; no source, imagery or pool tile assets copied.

Riverbed: Low Tide Rocks diffuse 2K, Dimitrios Savva, [Poly Haven](https://polyhaven.com/a/low_tide_rocks), CC0 1.0. Supplied archive filename matches the published asset; source attribution is inferred from the matching name because the archive contains no license file. Only the supplied diffuse JPEG is used; EXR normal/roughness and displacement maps are not loaded.

Riverbanks: Ganges River Pebbles diffuse 2K, Amal Kumar, [Poly Haven](https://polyhaven.com/a/ganges_river_pebbles), CC0 1.0. Attribution and source are inferred from the filename matching the published asset; the supplied archive has no license file. Only the diffuse JPEG is used; the supplied EXR normal/roughness and displacement maps are not loaded.

Rock diffuse: Coast Sand Rocks 02, Rob Tuytel, [Poly Haven](https://polyhaven.com/a/coast_sand_rocks_02), CC0; source inferred from matching filename, as supplied archive includes no license file. Only diffuse JPEG is used.

Hero yellow-birch leaf surface: `public/assets/yellow-birch-hero-albedo.png`, original AI-generated image created with OpenAI image generation for this project on November 4, 2026. Flat gold/autumn tissue atlas with pinnate and reticulated veins; used as diffuse color and the source for subtle shader bump relief. No third-party leaf photograph was copied. Botanical morphology references: NC State Extension's Betula alleghaniensis account and Virginia Tech's Yellow Birch dendrology fact sheet. Those pages are references, not imported assets. James approved the improved leaf art in chat. The same atlas is used on both sides; a distinct underside scan is not claimed.

Rapier 3D (`@dimforge/rapier3d` 0.21.0), Dimforge, Apache-2.0. Its WASM and JavaScript bindings are distributed with the game; retain the dependency license. The project-authored leaf material is not a biological scan.

SeedThree (SkyeShark), MIT, inspected at commit `cf2eaad39d9b7355ed086aca2a95fb785e539242` as a candidate for tree and ground-cover reuse. No SeedThree source or assets are distributed by this milestone; the inspection checkout is ignored under output/. Any later import must include its MIT notice and the provenance of selected assets rather than assuming all audio/textures share identical terms.

Supplied understory: Fern 02, Dandelion 01, Celandine 01, Searsia Lucida, Moss 01, Grass Medium 01 and Nettle Plant, [Poly Haven](https://polyhaven.com/), CC0. Asset source names match the supplied archives; the archives contain no license text. Their official asset pages identify CC0. Selected low-cost variants and their PBR materials were converted with Blender by scripts/convert-understory.py; no original archives or Blender binaries are distributed. Runtime instances plants at sampled bank heights; Searsia is comparison-only because it is not Appalachian vegetation. Botanical identity of the generic fern/grass model is not verified. Exact source IDs are the GLB filenames in public/assets/understory/.

The new soil surface is a project-authored procedural Canvas texture, not a downloaded image or a scan.
