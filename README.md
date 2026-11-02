# Nexus Luma Leads

Onboarding questionnaire and lead form for Nexus Luma website packages. Each submission is saved as a color-coded row in the "Websites Leads Q4" Google Sheet.

## Structure

| Path | What it is |
|---|---|
| `public/index.html` | The whole site: one self-contained page (styles, script and logo inline). |
| `apps-script/Code.gs` | Google Apps Script web app that receives leads and writes them to the sheet. |
| `netlify.toml` | Netlify config: publishes `public/`, no build step. |

## Run locally

```sh
python3 -m http.server 8000 --directory public
```

Then open http://localhost:8000. Submissions from a local copy go to the live sheet too.

## Deploy to Netlify

Add new site → Import from Git → pick this repo. The settings come from `netlify.toml`, so leave the build command empty and the publish directory as `public`.

## Google Sheet connection

`LEAD_ENDPOINT` near the top of the script in `public/index.html` holds the Apps Script web app URL (ends in `/exec`). Set it to `""` to put the page in preview mode, where nothing is sent.

After editing `apps-script/Code.gs`, paste it into the sheet's Extensions → Apps Script editor, then Deploy → Manage deployments → Edit → New version. Editing the existing deployment keeps the same URL.

Other settings in the same config block: `BOOKING_URL` (Zoom scheduler shown after submitting) and `ADS_CONVERSION_SEND_TO` (Google Ads conversion, optional).
