# FAQ

**Source of truth:** `src/components/FAQ.js` (+ `FAQ.css`)
**Visual reference:** `preview/component-faq.html`
**Status:** documented

Two-column FAQ block. Left column = section label; right column = collapsible question rows. Three sections (Overview, Packs and Minutes, Features) with 2 / 6 / 4 questions respectively.

## Anatomy

```
<section.faq>
  <div.faq-container>
    <h2>FAQ
    <div.faq-sections>
      <div.faq-section> × 3
        <div.faq-section-header>
          <div.faq-section-label> <h3>{section name}
          <div.faq-questions-column>
            <div.faq-question-row> × N
              <button.faq-question-button>
                <div.faq-question-text> {question}
                <div.faq-icon> <svg> ↓ chevron, rotates when open
              <div.faq-answer> {answer}
```

Only one question can be open at a time (single-state `openQuestion`). Sections are not collapsible (state slot reserved for future use).

## Variants & states

| State | Effect |
|---|---|
| Closed (default) | Row collapsed, chevron points down |
| Open (`openQuestion === item.id`) | Row expanded, chevron rotates up, `aria-expanded={true}`, answer `aria-hidden={false}` |

Toggling a different question closes the previous one (single-open behavior).

## Props

None.

## Data shape (in source)

```js
faqData: [
  { section: 'Overview', questions: [{ id, question, answer }, ...] },
  { section: 'Packs and Minutes', questions: [...] },
  { section: 'Features', questions: [...] },
]
```

Question IDs use kebab-style (`signup`, `split`, `expiration`, `minutes-mean`, `deducted`, `remaining`, `job-fails`, `add-minutes`, `quality`, `live`, `meters`, `format`).

## Tokens used

`var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-border)`, `var(--color-panel1)`.

## Tone & copy rules

- Section title: **"FAQ"** (literal — three letters, no expansion)
- Section labels: **Title Case** ("Overview", "Packs and Minutes", "Features")
- **Question phrasing: short, plainly worded, never clever, sentence case.** "How do I sign up/sign in?" "What happens if a job fails?" "How do I split a full track?"
- "/" used for OR options: *"sign up/sign in"*
- Answers: technical, concrete, em dashes without spaces inline ("live recordings may work but results vary—studio-quality recordings produce the best notation")
- A11y: each question button has `aria-expanded` and `aria-controls`; answer has `role="region"` and `aria-hidden`

## Do / Don't

- **Do** add new questions by appending to the relevant section's `questions` array — just `id`, `question`, `answer`. Single source.
- **Do** keep IDs kebab-style, lowercase, unique across all sections.
- **Do** keep the single-open behavior. Don't allow multiple questions open simultaneously without revisiting the visual rhythm.
- **Don't** write questions in Title Case — they're sentence case here, deliberately. (Casing rules: Title Case for headings/CTAs, sentence case for FAQ questions and form labels.)
- **Don't** add emoji to questions or answers. Plain text only.

## Drift from generated spec

`preview/component-faq.html` shows a single-column accordion with question + chevron rows stacked. Real FAQ has the **two-column "section label on left, questions on right"** layout. **FE wins** — when scaffolding new accordion UIs, mirror the FE's two-column section pattern; the preview is the right primitive only for one-section accordions.
