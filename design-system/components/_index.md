# Component Index

Status legend:
- **`documented`** — shipped in `src/components/` and has a per-component spec.
- **`gap`** — preview HTML exists, no FE implementation yet. The preview is the spec until built.
- **`preview-only`** — visual reference only, not on the roadmap (note the row).

## Shipped components (FE is source of truth)

### Chrome & primitives

| Spec | Source | Preview reference |
|---|---|---|
| [Button](Button.md) | `src/components/ui/Button.js` | `preview/component-buttons.html` |
| [Header](Header.md) | `src/components/layout/Header.js` | `preview/component-menu.html` (nav patterns) |
| [Footer](Footer.md) | `src/components/layout/Footer.js` | — |
| [AccountIcon](AccountIcon.md) | `src/components/AccountIcon.js` | `preview/component-avatar.html`, `preview/component-dropdown.html` |
| [LoginModal](LoginModal.md) | `src/components/LoginModal.js` | `preview/component-modal.html` |

### Marketing

| Spec | Source | Preview reference |
|---|---|---|
| [Hero](Hero.md) | `src/components/Hero.js` | `preview/component-upload.html`, `preview/component-progress.html` |
| [Pricing](Pricing.md) | `src/components/Pricing.js` | `preview/component-card.html` |
| [ComparePlans](ComparePlans.md) | `src/components/ComparePlans.js` | `preview/component-table.html` |
| [Features](Features.md) | `src/components/Features.js` | — (hand-drawn outlined illustrations, inline) |
| [FAQ](FAQ.md) | `src/components/FAQ.js` | `preview/component-faq.html` |
| [Testimonials](Testimonials.md) | `src/components/Testimonials.js` | — |

### Product

| Spec | Source | Preview reference |
|---|---|---|
| [TranscriptionCard](TranscriptionCard.md) | `src/components/TranscriptionCard.js` | `preview/component-list-row.html` |
| [TranscriptionCardSkeleton](TranscriptionCardSkeleton.md) | `src/components/TranscriptionCardSkeleton.js` | `preview/component-skeleton.html` |
| [TranscriptionHistory](TranscriptionHistory.md) | `src/components/TranscriptionHistory.js` | — |
| [MidiConverter](MidiConverter.md) | `src/components/MidiConverter.js` | `preview/component-upload.html` |
| [StemSplitter](StemSplitter.md) | `src/components/StemSplitter.js` | `preview/component-upload.html` |

### Visualization

| Spec | Source | Preview reference |
|---|---|---|
| [VisualizationPanel](VisualizationPanel.md) | `src/components/visualization/VisualizationPanel.js` | — |
| [VisualizationTabs](VisualizationTabs.md) | `src/components/visualization/VisualizationTabs.js` | `preview/component-tabs.html`, `preview/component-segmented.html` |
| [MidiEditorView](MidiEditorView.md) | `src/components/visualization/MidiEditorView.js` | — |
| [MusicSheetView](MusicSheetView.md) | `src/components/visualization/MusicSheetView.js` | — |
| [PianoRollView](PianoRollView.md) | `src/components/visualization/PianoRollView.js` | — |
| [DownloadSection](DownloadSection.md) | `src/components/visualization/DownloadSection.js` | — |

### Content & layout

| Spec | Source | Preview reference |
|---|---|---|
| [About](About.md) | `src/components/About.js` | — |
| [Blog](Blog.md) | `src/components/Blog.js` | — |
| [Element](Element.md) | `src/components/Element.js` | — |
| [BusinessInformation](BusinessInformation.md) | `src/components/BusinessInformation.js` | — |
| [VariantHoverWrapper](VariantHoverWrapper.md) | `src/components/VariantHoverWrapper.js` | — |
| [LegalPage](LegalPage.md) | `src/components/PrivacyPolicy.js`, `RefundPolicy.js`, `TermsConditions.js` (shared layout, `LegalPage.css`) | — |
| [BusinessInformation](BusinessInformation.md) | `src/components/BusinessInformation.js` (uses `LegalPage.css`) | — |

## Gaps (preview exists, no FE implementation)

These previews describe patterns we have visual specs for but haven't built. Future generation should treat the preview HTML as the spec until a real component lands; once built, promote the entry to a per-component spec and `documented` status.

| Pattern | Preview | Likely host |
|---|---|---|
| Audio player | `preview/component-audio-player.html` | Visualization |
| Badges | `preview/component-badges.html` | UI primitive |
| Breadcrumbs | `preview/component-breadcrumbs.html` | Layout |
| Card (generic) | `preview/component-card.html` | UI primitive (Pricing currently subsumes) |
| Checkbox + radio | `preview/component-checkbox-radio.html` | Form primitive |
| Chips | `preview/component-chips.html` | UI primitive |
| Code block | `preview/component-code.html` | Content |
| Command palette | `preview/component-command-palette.html` | Product chrome |
| Divider | `preview/component-divider.html` | UI primitive |
| Empty state | `preview/component-empty-state.html` | Product |
| Form field (composed) | `preview/component-form-field.html` | Form primitive |
| Input | `preview/component-inputs.html` | Form primitive (raw `<input>` used inline today) |
| Keyboard shortcut | `preview/component-kbd.html` | UI primitive |
| Pagination | `preview/component-pagination.html` | Product |
| Progress | `preview/component-progress.html` | Hero subsumes; standalone primitive missing |
| Segmented control | `preview/component-segmented.html` | UI primitive |
| Select | `preview/component-select.html` | Form primitive |
| Sidebar | `preview/component-sidebar.html` | Layout (signed-in product) |
| Skeleton | `preview/component-skeleton.html` | Generalization of `TranscriptionCardSkeleton` |
| Slider | `preview/component-slider.html` | UI primitive |
| Spinner | `preview/component-spinner.html` | UI primitive |
| Stat tiles | `preview/component-stat-tiles.html` | Account / dashboard |
| Stepper | `preview/component-stepper.html` | Onboarding |
| Table | `preview/component-table.html` | Account / admin (ComparePlans is similar) |
| Toast / banner | `preview/component-toast-banner.html` | Product |
| Toggles | `preview/component-toggles.html` | Form primitive |
| Tooltip | `preview/component-tooltip.html` | UI primitive |
| Waveform | `preview/component-waveform.html` | Visualization |
| Timeline | `preview/component-timeline.html` | Account / activity |

## Token gaps

Variables that appear in `tokens.reference.css` but **not** in runtime `src/styles/tokens.css`. Filling these is deliberate, not automatic — only add a runtime variable when there's a real use case.

Run `grep -hEo "var\(--[a-z0-9-]+\)" src/components/**/*.css | sort -u` and cross-check against both files to keep this list current.

- Full type scale (`--fs-hero`, `--fs-h1`–`--fs-h3`, `--fs-body`, `--fs-button`) — runtime declares only `--font-family-sans` / `--font-family-alt`.
- Spacing scale (`--space-xs` … `--space-5xl`) — components use raw `px` today.
- Radii tokens (`--radius-pill`, `--radius-card`, etc.) — components use raw `px` today.
- Motion tokens (`--motion-fast`, `--motion-default`, `--motion-theme`) — components use raw `0.2s` / `1.2s` today.
- Shadow tokens (`--shadow-card`, `--shadow-primary-glow`) — runtime declares `--color-primary-shadow`; full shadow strings are inlined in component CSS.
- Button shape tokens (`--btn-padding-*`, `--btn-radius-*`) — Button.css uses raw values.

Don't refactor existing components to use these. Document them here so future generation can prefer tokens *if and when* they get added to runtime.
