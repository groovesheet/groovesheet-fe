# GrooveSheet Account Page PRD

## Goal
Design the signed-in account page for GrooveSheet so users can clearly understand their remaining minutes, manage billing and recharges, update personal account details, and handle core account settings without friction.

## Summary
After login, GrooveSheet should have a dedicated account area that acts as the user's control center. The page should answer the user's top questions immediately:
- How many minutes do I have left?
- What plan am I on?
- How do I recharge or buy more minutes?
- What has my usage been?
- How do I update my name, profile picture, or password?
- How do I manage notifications, billing, and support-related settings?

This page should prioritize clarity, fast self-service, and conversion to paid/recharge flows.

## Product objectives
1. Make remaining minutes and plan status instantly visible.
2. Reduce confusion around minutes, expiry, and billing.
3. Increase conversion to upgrades and top-ups.
4. Give users lightweight self-serve account management.
5. Keep the account page simple enough for first-time users but useful enough for power users.

## Primary user stories

### User story 1 — View remaining minutes
As a signed-in user,
I want to see my remaining minutes immediately,
so I know whether I can process another track.

#### Acceptance criteria
- Account page shows remaining minutes above the fold.
- Minutes display includes total remaining, current plan, and renewal/expiry context.
- If the user has multiple minute sources, the UI explains them clearly.
- If minutes are low, the page surfaces a recharge CTA.

### User story 2 — Recharge or upgrade
As a signed-in user,
I want to quickly buy more minutes or upgrade my plan,
so I can continue using GrooveSheet without hunting around the site.

#### Acceptance criteria
- Account page includes a clear recharge/top-up section.
- User can see at least 3 suggested purchase options or plans.
- Current plan is visually distinguished from other options.
- CTA labels are explicit, e.g. "Buy 60 more minutes", "Upgrade to Lite".
- If the user is already on a paid plan, show both upgrade and one-time top-up options when applicable.

### User story 3 — Understand usage and billing
As a signed-in user,
I want to understand where my minutes went,
so I trust the billing model.

#### Acceptance criteria
- Account page shows a recent usage summary.
- At minimum, show recent jobs, duration consumed, and timestamps.
- If available, show minute expiry/renewal info.
- Failed jobs should not appear as deducted usage unless the system truly deducted them.

### User story 4 — Manage profile
As a signed-in user,
I want to manage my profile details,
so my account reflects my identity and preferences.

#### Acceptance criteria
- User can view and edit display name.
- User can view and update profile picture if supported by auth provider.
- User can view email address, even if it is not editable.
- If editing is restricted by auth provider, the UI explains where to manage it.

### User story 5 — Manage account security
As a signed-in user,
I want to reset or update my password,
so I can keep my account secure.

#### Acceptance criteria
- Account page includes a clear "Change password" or "Reset password" action.
- If GrooveSheet uses Clerk-hosted auth flows, route the user to the correct Clerk flow.
- If password auth is unavailable for the user (e.g. SSO-only), hide or adapt the control.

### User story 6 — Manage preferences
As a signed-in user,
I want to manage basic settings,
so the product behaves the way I expect.

#### Acceptance criteria
- Page includes a lightweight settings area.
- At minimum, settings can include email notifications and product preferences if supported.
- Settings must avoid becoming a dumping ground for unrelated controls.

## Proposed information architecture

### Section 1 — Account header
Purpose: identity + high-level account state.

Contents:
- Profile picture
- Display name
- Email address
- Current plan badge
- Short account status text

Example:
- Edward Zhang
- edward@example.com
- Plan: Lite
- 43 minutes remaining

### Section 2 — Minutes and usage overview
Purpose: the most important functional information.

Contents:
- Remaining minutes card
- Renewal or expiry date
- Progress bar or meter
- Short explanatory text about how minutes are deducted
- Low-balance warning if under threshold

Recommended metrics:
- Remaining minutes
- Monthly included minutes
- Top-up minutes remaining
- Renewal date or package expiry

### Section 3 — Recharge / upgrade actions
Purpose: revenue and continuity.

Contents:
- Top-up cards
- Upgrade plan cards
- Current plan highlight
- "Manage subscription" link if recurring billing exists

Recommended top-up presentation:
- 30 min top-up
- 60 min top-up
- 120 min top-up

Recommended plan presentation:
- Free
- Lite
- Pro

### Section 4 — Recent usage / billing activity
Purpose: transparency and trust.

Contents:
- Recent jobs list
- Minutes consumed per job
- Date/time
- Result/status
- Link to full history page if needed

Optional extras:
- Invoice / receipt history
- Billing portal link

### Section 5 — Profile and security
Purpose: user self-service.

Contents:
- Edit display name
- Update profile picture
- Change/reset password
- Manage linked sign-in methods if supported

### Section 6 — Settings
Purpose: lightweight preferences.

Candidate settings:
- Email notifications for finished jobs
- Product updates / marketing opt-in
- Default export preferences
- Theme or language if already supported globally

### Section 7 — Support / help
Purpose: reduce support burden.

Contents:
- FAQ shortcuts for minutes and billing
- Contact support CTA
- Link to refund policy / terms / privacy policy

## Recommended MVP scope

### Must-have for V1
1. Account header with name, email, avatar
2. Remaining minutes card
3. Plan name and renewal/expiry context
4. Recharge/top-up CTA
5. Upgrade/manage subscription CTA
6. Recent usage summary
7. Change/reset password action
8. Basic profile edit controls

### Nice-to-have for V1.1
1. Billing history / invoices
2. Notification preferences
3. Linked auth providers
4. Minute breakdown by source
5. Inline help tooltips for billing concepts

### Later / optional
1. Team/workspace account settings
2. Referral credits
3. Promo code redemption
4. Download preference defaults
5. Saved export presets

## UX principles
1. Minutes first — this is the main reason users visit the page.
2. Billing clarity over cleverness — avoid ambiguous labels like "credits" if the site mostly uses "minutes".
3. Clear hierarchy — account identity first, usage second, monetization third, settings fourth.
4. Explain edge cases — expiry, rollover, failed jobs, mixed top-up + subscription balances.
5. Keep sensitive actions safe — changing password, plan, or billing should have explicit confirmation or redirect flows.

## Naming recommendation
Use "Minutes" as the primary unit in the UI, not a mix of "credits" and "minutes", unless the backend model truly distinguishes both.

Recommended copy:
- "Minutes remaining"
- "Recharge minutes"
- "Usage this cycle"
- "Renews on"
- "Top-up expires on"

Avoid mixing:
- "Credits"
- "Balance"
- "Tokens"
Unless there is a deliberate product decision to rename the billing unit.

## Page layout recommendation

### Desktop
Two-column layout:
- Left/main column: minutes, recharge, recent usage
- Right/side column: profile, security, settings, support

### Mobile
Single-column stacked layout:
1. Header
2. Minutes card
3. Recharge CTA
4. Plan details
5. Recent usage
6. Profile/security
7. Settings/support

## Functional requirements

### FR-1 Account identity
- **FR-1.1** Show user's display name.
- **FR-1.2** Show user's email address.
- **FR-1.3** Show profile image when available.
- **FR-1.4** Provide fallback avatar initials if no image exists.

### FR-2 Minutes summary
- **FR-2.1** Show remaining minutes.
- **FR-2.2** Show current plan allowance or package allocation.
- **FR-2.3** Show renewal date for subscriptions when applicable.
- **FR-2.4** Show expiry date for purchased minute packs when applicable.
- **FR-2.5** If balance is low, surface a warning state and recharge CTA.

### FR-3 Recharge and plan actions
- **FR-3.1** User can purchase additional minutes from the account page.
- **FR-3.2** User can upgrade plan from the account page.
- **FR-3.3** User can open billing/subscription management portal.
- **FR-3.4** Current plan must be visually marked.

### FR-4 Usage visibility
- **FR-4.1** Show recent usage activity.
- **FR-4.2** Each usage row should show job name or file name, timestamp, and minutes consumed.
- **FR-4.3** Failed jobs should show status clearly.
- **FR-4.4** Link to full history page if more records exist.

### FR-5 Profile management
- **FR-5.1** User can edit display name.
- **FR-5.2** User can update profile image if supported.
- **FR-5.3** User can see immutable identity fields if they cannot edit them.

### FR-6 Security
- **FR-6.1** User can change/reset password through the supported auth flow.
- **FR-6.2** If the user signed in via SSO-only, hide password controls or explain that password is managed by the identity provider.

### FR-7 Settings
- **FR-7.1** User can manage notification preferences if supported.
- **FR-7.2** User can manage product/account preferences relevant to GrooveSheet use.
- **FR-7.3** Do not expose admin-only or backend-only settings here.

## States and edge cases

### Empty / free-tier state
- Show free plan.
- Show current monthly minutes.
- Encourage upgrade with clear value proposition.

### Low minutes state
- Highlight remaining minutes in warning color.
- Show top-up CTA above the fold.
- Explain that processing may stop when balance reaches zero.

### Zero minutes state
- Show strong CTA to top up or upgrade.
- If uploads are blocked at zero, explain this clearly.

### Mixed balance state
If the user has both subscription minutes and purchased top-up minutes:
- Show total minutes remaining.
- Optionally show breakdown by source.
- Explain deduction order if relevant.

### No billing yet state
- Show free/default account state.
- Hide invoice history if empty.
- Keep recharge and upgrade options visible.

### Auth-provider-managed profile state
If Clerk or social provider owns the profile field:
- Show field as read-only where necessary.
- Provide a "Manage in account settings" or provider-driven flow.

## Suggested UI modules
1. `AccountHeaderCard`
2. `MinutesBalanceCard`
3. `RechargeOptionsCard`
4. `PlanSummaryCard`
5. `RecentUsageCard`
6. `ProfileSettingsCard`
7. `SecuritySettingsCard`
8. `PreferencesCard`
9. `SupportCard`

## Data requirements
Likely required from backend/auth/billing layers:
- User ID
- Display name
- Email
- Avatar URL
- Current plan
- Minutes remaining
- Minute allocation
- Renewal date
- Top-up balances
- Top-up expiry dates
- Recent usage records
- Billing portal URL
- Available recharge products
- Available upgrade plans

## Backend / integration questions to resolve
1. Is the product model officially "minutes" only, or are there separate "credits" under the hood?
2. Can a user have both subscription minutes and one-time top-up minutes simultaneously?
3. What is the deduction order between monthly included minutes and purchased packs?
4. Is billing handled by Stripe, Paddle, or another provider?
5. Is profile editing handled directly in GrooveSheet or via Clerk components/flows?
6. Is password reset available for all users or only email/password users?
7. Is there already an endpoint for recent minute consumption by job?

## Success metrics
1. Increase account-page-to-purchase conversion.
2. Reduce support questions about remaining minutes and expiry.
3. Increase percentage of signed-in users who can self-serve billing/profile changes.
4. Reduce drop-off from zero-minute state.

## Out of scope for this PRD
- Full team billing / multi-seat admin
- Deep invoice/accounting workflows
- Full settings center for every possible product preference
- Complex CRM or loyalty systems

## Recommended implementation phases

### Phase 1 — Core account page
- Identity header
- Remaining minutes
- Current plan
- Recharge CTA
- Upgrade/manage subscription CTA
- Password reset
- Basic profile info

### Phase 2 — Transparency and trust
- Recent usage breakdown
- Minute source breakdown
- Expiry/renewal explanations
- Billing history links

### Phase 3 — Preferences and polish
- Notifications
- Export defaults
- Better edge-case messaging
- Help/tooltips/support shortcuts

## Suggested route and navigation behavior
- Route: `/account`
- Signed-in header/avatar menu should link here.
- If a user is not authenticated, redirect to sign-in.
- This page should become the canonical place for "Billing & Usage".

## Copy recommendations
- "Minutes remaining"
- "Recharge"
- "Manage subscription"
- "Usage this cycle"
- "Recent processing activity"
- "Profile"
- "Security"
- "Preferences"

## Final recommendation
For V1, GrooveSheet should build the account page around one hero component: the minutes balance and next action. Everything else supports that. If the page tries to do too much, users will still not know the one thing they came to check: whether they can keep processing tracks.

The strongest first release is:
- name/avatar/email
- minutes remaining
- plan + renewal
- recharge/upgrade
- recent usage
- reset password

That gives both product clarity and a direct monetization path.
