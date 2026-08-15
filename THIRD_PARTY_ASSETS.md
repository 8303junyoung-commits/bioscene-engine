# Third-party asset registry

BioScene stores licensing information at the individual asset level. Downloading an entire library does not imply that every item has the same license.

## Bulk Bioicons library

The searchable library in `public/assets/bioicons-library/` contains 1,526 SVG assets (118,757,657 bytes) across 18 BioScene-relevant categories. The machine-readable `manifest.json` records every asset's category, author, license folder, source URL, byte size, and SHA-256 hash.

License distribution: 172 CC0, 1,145 CC BY 3.0, 189 CC BY 4.0, 12 CC BY-SA 4.0, and 8 MIT assets. A security gate rejected 142 SVGs containing `foreignObject`, external references, or malformed SVG roots; rejected files were not copied into the deliverable library.

Use `asset-catalog.html` to search and preview the collection without loading the full library into the editor bundle.

## Locally staged starter assets

Four SVG primitives are staged in `public/assets/bioicons/`. Their checksums and machine-readable metadata are in `manifest.json`.

| Local file | Semantic role | Creator / source | License |
| --- | --- | --- | --- |
| `servier-antibody.svg` | Antibody | Servier Medical Art via Bioicons | CC BY 3.0 |
| `servier-receptor-membrane.svg` | Membrane receptor | Servier Medical Art via Bioicons | CC BY 3.0 |
| `servier-nucleus.svg` | Nucleus | Servier Medical Art via Bioicons | CC BY 3.0 |
| `servier-protein.svg` | Generic protein | Servier Medical Art via Bioicons | CC BY 3.0 |

Required attribution: **Medical illustrations by Servier, via Bioicons, licensed under CC BY 3.0.**

- [Bioicons](https://bioicons.com/)
- [Servier Medical Art](https://smart.servier.com/)
- [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)

The downloaded SVGs were checked for scripts, `foreignObject`, JavaScript URLs, and external resource references. None were found.

## Source links from the v2 concept document

| Source | Intended use | Local status |
| --- | --- | --- |
| [Bioicons](https://bioicons.com/) | SVG primitives across cell biology and immunology | Four individual assets staged |
| [Bioicons extensions](https://bioicons.com/extensions/) | Draw.io / Inkscape exploration | Link recorded; no extension installed |
| [Servier Medical Art](https://smart.servier.com/category/medical-specialties/immunology-and-haematology/) | Immunology and haematology illustrations | Accessed indirectly through Bioicons assets with explicit license paths |
| [NIAID NIH BioArt Source](https://bioart.niaid.nih.gov/) | Public-domain immune and infection vectors | Link recorded; download only after selecting a specific biologically appropriate item |
| [SciDraw](https://scidraw.io/) | Reusable scientific illustrations | Link recorded; per-item attribution required |
| [SciDraw licensing](https://scidraw.io/licensing) | License reference | Link recorded |
| [Reactome Icon Library](https://reactome.org/icon-lib) | Proteins, receptors, cells, therapeutics | Link recorded; CC BY 4.0 attribution required |
| [SwissBioPics](https://www.swissbiopics.org/) | Cells, organelles, organism structures | Link recorded; per-item metadata required |
| [RCSB PDB downloads](https://www.rcsb.org/downloads) | Structure-derived references | Link recorded; not needed for the schematic MVP |
| [Wikimedia Commons](https://commons.wikimedia.org/) | Long-tail coverage | Link recorded; file-level license review required |

## Ingestion rule

Before an asset becomes selectable in the application:

1. Confirm that its biological role matches the semantic object.
2. Save its original URL, creator, license URL, retrieval date, and SHA-256 hash.
3. Reject active SVG content or external resource references.
4. Keep the untouched source file and create edited derivatives separately.
5. Preserve attribution in exported figures whenever the license requires it.
