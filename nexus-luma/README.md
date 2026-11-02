# Nexus Luma — Welcome Email Template

## Files

| File | Purpose |
|---|---|
| `nexus-luma-welcome-email.html` | Production template with `{{placeholders}}`. This is the file you send. |
| `nexus-luma-welcome-email-preview.html` | Browser preview with sample values ("Daniel", relative `assets/` paths). Do not send it. |
| `assets/` | Optimized images cut from the approved reference design. |

## 1. Host the assets

Upload everything in `assets/` to a public HTTPS location (your site, Mailchimp Content Studio, S3/CloudFront, etc.) — e.g. `https://nexusluma.com/email/welcome/`.
Email clients cannot load local or relative paths, and base64 images are blocked by many clients.

| Asset | Shown at | Used by |
|---|---|---|
| `nexus-luma-logo.png` | 330 × 58 | `{{logo_url}}` |
| `hero-character.jpg` | 235 × 218 (full width on mobile) | `{{cartoon_url}}` |
| `hero-bg-right.jpg` | 365 × 218 (headline background) | `{{assets_base_url}}` |
| `laptop.jpg` | 140 × 82 | `{{assets_base_url}}` |
| `brochure-mockup.jpg` | 204 × 164 (up to 300 on mobile) | `{{brochure_image_url}}` |
| `footer-wave.jpg` | 600 × 29 | `{{assets_base_url}}` |
| `footer-bg.jpg` | footer background | `{{assets_base_url}}` |
| `nexus-luma-globe.png` | 46 × 31 (transparent) | `{{assets_base_url}}` |
| `icon-*.png` | 30 × 30 (transparent) | `{{assets_base_url}}` |

## 2. Variables

| Variable | Example |
|---|---|
| `{{first_name}}` | Subscriber first name — **must fall back to "there"** (see below) |
| `{{brochure_url}}` | Direct link to the hosted PDF brochure |
| `{{website_url}}` | `https://nexusluma.com` |
| `{{assets_base_url}}` | `https://nexusluma.com/email/welcome` (no trailing slash) |
| `{{logo_url}}` | `{{assets_base_url}}/nexus-luma-logo.png` |
| `{{cartoon_url}}` | `{{assets_base_url}}/hero-character.jpg` |
| `{{brochure_image_url}}` | `{{assets_base_url}}/brochure-mockup.jpg` |
| `{{unsubscribe_url}}` | Your platform's unsubscribe link |
| `{{company_address}}` | Physical mailing address (required by CAN-SPAM) |
| `{{facebook_url}}` `{{linkedin_url}}` `{{youtube_url}}` `{{instagram_url}}` | Your real profile URLs |

`{{assets_base_url}}` was added on top of the requested list so the supporting images (hero background, laptop, footer, icons) need only one setting. `{{brochure_url}}` appears twice (button + Outlook button) and on the brochure image; replace all occurrences.

**Social icons:** if you don't have a profile, delete that icon's `<td>` in the footer rather than leaving a dead link.

## 3. Platform syntax

Find-and-replace each `{{variable}}` with your platform's merge tag. The hosted URLs (logo, assets, brochure, website, social) are usually best pasted in as plain text rather than merge tags.

### Mailchimp
| Template | Mailchimp |
|---|---|
| `Hi {{first_name}},` | `Hi *\|IF:FNAME\|**\|FNAME\|**\|ELSE:\|*there*\|END:IF\|*,` |
| `{{unsubscribe_url}}` | `*\|UNSUB\|*` |
| `{{company_address}}` | `*\|HTML:LIST_ADDRESS_HTML\|*` |

Import via **Campaigns → Email templates → Create template → Code your own → Paste in code**.

### n8n (Send Email / Gmail / SMTP node, HTML body)
n8n expressions use the same braces, so swap each placeholder for an expression:
- `Hi {{ $json.first_name || 'there' }},`
- `{{ $json.unsubscribe_url }}` etc., or hard-code the static URLs.

Easiest: keep the template in a Code node, run `.replaceAll('{{first_name}}', item.first_name || 'there')` for each variable, then pass the result to the email node.

### Handlebars-based tools (SendGrid dynamic templates, Postmark, etc.)
- `Hi {{#if first_name}}{{first_name}}{{else}}there{{/if}},`
- SendGrid unsubscribe: `{{{unsubscribe}}}` or `<%asm_group_unsubscribe_raw_url%>`.

### HubSpot / ActiveCampaign / Klaviyo
- HubSpot: `{{ contact.firstname|default("there") }}`, unsubscribe `{{ unsubscribe_link }}`
- ActiveCampaign: `%FIRSTNAME%` (set the fallback in the personalization menu), unsubscribe `%UNSUBSCRIBELINK%`
- Klaviyo: `{{ first_name|default:"there" }}`, unsubscribe `{% unsubscribe_url %}`

## 4. How it's built

- 600px table layout, inline styles, media query at 620px for mobile stacking.
- Montserrat from Google Fonts where supported (Apple Mail, iOS, some Android); falls back to Arial (Gmail, Outlook).
- **Hero:** character image on the left, headline + yellow panel as live HTML text on a background image. Outlook desktop gets the background via VML. On mobile the character goes full width above the headline, so nothing overlaps.
- **CTA:** real `<a>` link with a gradient pill; Outlook desktop gets a VML `roundrect` with a gradient fill.
- **Cards:** rounded corners and shadows in clients that support them; Outlook desktop shows square corners with the same colors and borders.
- Preheader text is included (edit it at the top of `<body>`).

## 5. Known limitations — please read

- **Image sharpness:** all artwork was cut from the 1001px-wide reference image. At the 600px email width that's about **1.6–1.8× density**, not a full 2×. It looks sharp on standard screens and good on most retina screens, but if you have the original high-resolution files (logo, mascot, laptop, brochure cover), export them at 2× the "Shown at" sizes above and replace the files with the same names.
- **Hero background:** the headline area's background was reconstructed from the reference (the baked-in text was removed), so it is a smooth blue glow with light streaks rather than a pixel-exact copy.
- **Footer icons** are cropped from the reference at 44px for a 30px display.
- **Testing:** the preview was checked in Chrome at desktop (680px) and mobile (390px) widths only. It has **not** been tested in Outlook, Gmail, Apple Mail or other real clients. Send test emails or run it through Litmus / Email on Acid before your first send.
- `{{brochure_url}}` must point at the real hosted PDF before sending.
