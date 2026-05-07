# Testimonials

**Source of truth:** `src/components/Testimonials.js` (+ `Testimonials.css`)
**Visual reference:** —
**Status:** documented

Three-column wall of musician quotes. 9 testimonials hard-coded in source, sliced 3+3+3 across columns.

## Anatomy

```
<section.testimonials>
  <div.testimonials-container>
    <div.testimonials-header>
      <h2>Trusted by Musicians and Educators
      <p>See how people are using us. Real users. Real tracks. Faster practice and cleaner charts
    <div.testimonials-grid>
      <div.testimonials-column> × 3
        <div.testimonial-card> × 3
          <div.testimonial-header>
            <img.testimonial-avatar>          ← 108×108 builder.io image URL
            <div.testimonial-author>
              <h4.testimonial-name>{name}
              <p.testimonial-role>{role}
          <p.testimonial-text>{text}
```

## Variants & states

Static. No interaction, no state.

## Props

None.

## Data shape

```js
testimonials: [{ name, role, image, text }, ...]
```

Avatar images currently sourced from `https://api.builder.io/api/v1/image/assets/TEMP/...?width=108`. These are placeholder URLs — keep them or swap for real photos as the brand pipeline matures.

## Tokens used

`var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-panel1)`, `var(--color-border)`.

## Tone & copy rules

- Section title: **"Trusted by Musicians and Educators"** (Title Case)
- Subtitle in sentence case with deliberate fragmenting: *"See how people are using us. Real users. Real tracks. Faster practice and cleaner charts"* (no period at the end — intentional, not a typo)
- Names like real people: *"Maya R."*, *"Daniel Kim"*, *"LT (Leo Torres)"*, *"@yuki_m"*, `"\"K\""` — varied formats, including initials and handles
- Roles in Title Case: *"Session drummer"*, *"Drum Teacher"*, *"Bandleader"*
- **Quote text uses musician slang** as part of the brand voice: *"locked to the click"*, *"finally nailed that triplet fill"*, *"one more listen"*. Concrete situations: *"messy iPhone rehearsal"*, *"Night-before gig. Four songs."*

## Do / Don't

- **Do** preserve the slangy, voicey tone if adding new quotes. Generic praise ("Great product!") doesn't fit.
- **Do** keep names varied — real names, initials, handles. Not all formal "Firstname Lastname".
- **Do** the 9-quotes-in-3-columns rhythm. Adding a 10th breaks the column grid math; either replace one or add 3 (full new row).
- **Don't** use stock photos. Avatars should be musician-y if real, or stay on the placeholder pipeline.
- **Don't** write in marketing-speak. Working-musician casual or skip it.

## Drift from generated spec

No standalone preview HTML. `VISUAL_GUIDE.md` describes testimonial voice rules and three-column layout as is. The avatars-from-builder-io URL is a delivery quirk to keep or replace deliberately — don't change without coordinating with the image pipeline.
