# Bug tracker

Lightweight, in-repo bug log. One markdown file per bug, versioned with the code.

## How we file

- Copy `_TEMPLATE.md` to `BUG-NNN-short-slug.md` (next free number).
- Fill in what is known; leave `Repro` rough if not yet nailed down.
- Add a row to the index below.

## Status values

`open` -> `investigating` -> `fixed` (link the commit/PR) -> `closed`. Use
`wontfix` / `cannot-reproduce` when they apply.

## Severity

- `blocker` — data loss, corruption, or the app is unusable.
- `major` — core feature broken, no clean workaround.
- `minor` — cosmetic or edge case with a workaround.

## Index

| ID | Title | Area | Severity | Status |
| --- | --- | --- | --- | --- |
| [BUG-001](BUG-001-multi-tab-shape-duplication.md) | Shapes multiply across tabs on the same board | realtime sync | blocker | investigating |
