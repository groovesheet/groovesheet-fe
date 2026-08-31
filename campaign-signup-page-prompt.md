# Brief: GrooveSheet campaign signup page (`/signup/:code`)

## What we're building

A **campaign-specific signup landing page** for GrooveSheet — one reusable page template
that is rendered per promo code. The first live instance is for a school band CCA group
("Geyao"), reached at:

```
https://groovesheet.net/signup/geyao2026
```

Anyone who creates an account through this link gets **30 free minutes of processing
credit**. The page must be built as a *template driven by campaign data*, not hard-coded
to this one event — we will reuse it for other CCAs, school clubs, event sponsorships,
partner communities and creator collabs, each with its own code, name, and credit amount.

## Who lands here

Student musicians in a school band, arriving from a WhatsApp/WeChat group message or a
QR code on a poster. Mobile-first traffic. Most have never heard of GrooveSheet and have
no idea what it does. They arrive because a friend or a senior in their CCA sent the
link, so social proof of "this was shared with our group" is the strongest hook.

Many of them read Chinese. The site already ships English, Simplified Chinese and
Traditional Chinese (`/`, `/zh-CN/`, `/zh-TW/`), so all copy on this page needs to be
translatable strings — no text baked into images.

## What the page must accomplish

In priority order:

1. **Get the visitor to create an account.** That is the only conversion goal. Every
   other element exists to serve it.
2. **Make the offer unmistakable** — they get 30 minutes free, granted automatically,
   no payment details, no trial that silently bills them.
3. **Explain what GrooveSheet actually does** in the ~15 seconds before they bounce.
   Assume zero prior knowledge.
4. **Make the offer feel legitimate and specific to their group** — not a generic
   internet coupon. The campaign name ("Geyao") should appear as a personalised
   acknowledgement that this link was made for them.
5. **Confirm the grant after signup** so they know the credit actually landed and
   know what to do next.

## Product facts (use these — they must be accurate in copy)

GrooveSheet turns a song recording into playable sheet music. Three things it does:

- **Transcription** — audio → notated sheet music (drums, piano, bass, guitar).
- **Stem separation** — split a mixed track into isolated instrument stems.
- **MIDI generation** — audio → MIDI you can open in a DAW or notation editor.

**How credit works — important, get this right in the copy:**

- Credit is a **single shared pool measured in minutes of audio**. It is *not* split
  per feature. The 30 minutes can be spent on transcription, stem separation, MIDI
  generation, or any mix of the three.
- Cost is charged by **length of the audio processed**, regardless of which service is
  used. A 4-minute song costs 4 minutes of credit.
- So 30 minutes ≈ **7–8 full songs**. That's a useful concrete anchor for the copy.
- Failed jobs are automatically refunded, so users don't lose credit to errors.

**Why this offer is genuinely worth something:** the free tier grants **zero** processing
credit — free users only get a 10-second preview of any song. 30 minutes is the same
amount as our paid $4 Starter top-up pack. This page is the only way to run full songs
for free, and the copy should convey that value honestly without overclaiming.

## Signup mechanics

Authentication runs through Clerk, and the existing site offers, in this order:

- Continue with **Google**
- Continue with **Facebook**
- Continue with **Apple**
- Continue with **email** → a 6-digit verification code is emailed → enter code → done

There is no password. There is no separate "sign up" vs "log in" — the same flow handles
both. This page should present those same four options inline on the page itself (not
behind a button that opens a modal), so the path from landing to account is as short as
possible. There is also an existing opt-in checkbox for product-update emails; keep an
equivalent.

The promo code is carried in the URL. The visitor should never have to type it, but the
page should show it, so they can see the right code is applied.

## Content the page needs

Treat this as the required substance, not a section-by-section layout:

- **The offer, stated plainly and early** — 30 free minutes, for the named group, no card
  required.
- **The signup control itself**, reachable without scrolling on a phone.
- **What GrooveSheet does** — the three capabilities, in language a 16-year-old drummer
  understands. Real, concrete outcome ("upload the song your band is covering, get the
  drum chart") beats feature nouns.
- **What 30 minutes buys** — the ~7–8 songs anchor, and the fact that it's one pool
  spendable across all three services.
- **Something that shows the product working.** A before/after of audio → sheet music
  is the single most persuasive element on this page. We can supply real example
  renders; specify what you need.
- **Why this is relevant to a school band specifically** — learning a cover, writing out
  parts for bandmates, isolating one instrument to practise along with, transcribing a
  song with no available sheet music.
- **Reassurance / objection handling**, briefly: no credit card, credit is granted
  automatically on signup, nothing auto-charges when the free minutes run out, account
  keeps working afterwards on the free preview tier.
- **A light FAQ** — 3–5 questions max. Candidates: does it work for my instrument, how
  accurate is it, what file types, what happens when the 30 minutes run out, can I export
  to MuseScore/PDF/MIDI.
- **Footer essentials** — links to terms, privacy, and the main site.

## Page states to design

This is the part most easily forgotten; all of these are real:

1. **Default** — valid code, visitor not signed in. The main event.
2. **Success / post-signup** — account created, credit granted. Must confirm the balance
   ("30 minutes added to your account") and push to the next action: upload a song. This
   is a distinct state, not a toast.
3. **Already signed in** — an existing logged-in user opens the link. Show whether they
   can claim (they may already have an account and be ineligible) and route them
   appropriately.
4. **Already redeemed** — this account, or this person, already claimed this campaign.
   Friendly, not accusatory, with a route back into the product.
5. **Invalid / unknown code** — a mistyped or made-up code. Should not dead-end; still
   sell the product and offer normal signup.
6. **Expired campaign** — the code was real but the campaign has ended. Same principle:
   soft landing, not a 404.
7. **Loading** — campaign details are fetched before render; the page must not flash
   wrong content.

## Make it reusable — the campaign data model

Everything campaign-specific must come from a config object, so launching the next
campaign is a data change and not a redesign. Design the page assuming these fields, and
tell us if you need more:

```json
{
  "code": "geyao2026",
  "campaignName": "Geyao",
  "displayName": "Geyao Band CCA",
  "creditMinutes": 30,
  "headline": null,
  "subheadline": null,
  "logoUrl": null,
  "accentColor": null,
  "expiresAt": "2026-12-31",
  "active": true
}
```

Design constraints that follow from this:

- The layout must not break when `displayName` is much longer or much shorter than
  "Geyao Band CCA", and must survive Chinese text of very different width.
- `creditMinutes` is a variable — 30 today, could be 60 or 15 next time. Any derived
  claim in the copy (like "≈7–8 songs") must be computed from it, not hard-coded.
- `logoUrl` and `accentColor` are optional. The page must look complete and intentional
  with both absent — that is the common case, and the first campaign has neither.
- Anything a future campaign owner might want to change (headline, subheadline) should be
  an overridable field with a sensible generated default.

## Constraints

- **Mobile first.** The overwhelming majority of this traffic is a phone, opened from a
  group chat.
- **All copy must be i18n-ready strings** (English, Simplified Chinese, Traditional
  Chinese). No text inside images.
- **Fast.** Shared into a chat group means link previews and slow connections; keep the
  page light.
- Must fit inside the existing GrooveSheet site (site header/footer, existing brand).
- The page will be shared as a raw URL and as a QR code — the URL itself should look
  trustworthy, and OG/link-preview metadata should be campaign-aware so the chat-group
  preview card sells the offer too.

## Deliverable

The full page design covering every state listed above, plus whatever supporting
components it needs. **No design direction is being given deliberately — the visual
approach, structure, hierarchy, tone of the layout and the section ordering are entirely
your call.** Use your judgement on what actually converts here.

If you need specific assets from us — example sheet-music renders, audio samples, logos,
screenshots of the product — say which ones and we'll supply them.
