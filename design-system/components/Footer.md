# Footer

**Source of truth:** `src/components/layout/Footer.js` (+ `Footer.css`)
**Visual reference:** —
**Status:** documented

Site-wide footer. Three-column main row, two-row bottom bar.

## Anatomy

```
<footer.footer>
  <div.footer-container>
    <div.footer-main>
      <div.footer-brand>
        <div.footer-logo>      ← theme-aware logo (Logo_White / Logo_Dark)
        <div.footer-social>
          <div.social-icons>   ← 16 Phosphor logos (size 32, weight="fill")
      <div.footer-links>
        <div.footer-column> Explore: Pricing, API, Help, Support, Changelog
        <div.footer-column> Apps: Desktop App, iOS App, Android App
      <div.footer-language>
        <div.language-selector> En ⌄
    <div.footer-bottom>
      <div.footer-bottom-left>
        <Link.copyright> © {{year}} GrooveSheet ← links to /business-information
        <div.footer-legal> Terms / Privacy / Refund
```

## Variants & states

- Theme-aware logo only. No other dynamic states.

## Props

None — Footer takes no props. Theme is read internally from `useTheme()`.

## Tokens used

`var(--color-foreground)`, `var(--color-border)`, `var(--color-panel1)`, `var(--color-muted-foreground)`. Container width matches Header at `1414px`.

## Social icons (verbatim list from source)

Facebook, Instagram, X, YouTube, TikTok, Reddit, GitHub, LinkedIn, Discord, Dev.to, SoundCloud, Medium, Threads, Tumblr, Twitch, Pinterest. All from `@phosphor-icons/react` with `weight="fill"` and `size={32}`. Hrefs are real GrooveSheet account URLs (don't break them).

## Tone & copy rules

- Column headings in **Title Case** ("Explore", "Apps")
- Link text in Title Case ("Pricing", "Desktop App")
- Copyright reads `© {{year}} GrooveSheet` (i18n key `footer.copyright`), links to `/business-information`

## Do / Don't

- **Do** add new social platforms by appending to the `socialIcons` array with `name`, `component` (Phosphor export name), and `href`.
- **Do** keep `weight="fill"` for socials. UI-chrome icons elsewhere use `weight="regular"`.
- **Don't** hardcode the copyright — it's the i18n string `footer.copyright` (`© {{year}} GrooveSheet`).
- **Don't** add a background color — Footer sits on the same canvas as Header.

## Drift from generated spec

`VISUAL_GUIDE.md` says the footer is "simple" with logo + 16 social icons + two columns + language; current FE matches that. No divergence — the copyright now reads `GrooveSheet` (rebranded from the legacy "DrumScore" string).
