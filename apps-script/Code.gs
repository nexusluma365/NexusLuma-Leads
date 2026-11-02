/**
 * Nexus Luma — Website Lead Builder
 * Receives questionnaire submissions from the onboarding page and records them
 * in the "Websites Leads Q4" tab, one color-coded row per lead.
 *
 * Setup: paste into Extensions → Apps Script, run setupSheet once, then
 * Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * Put the /exec URL in LEAD_ENDPOINT in index.html.
 *
 * Welcome email: add an HTML file named "WelcomeEmail" to this Apps Script
 * project and paste in nexus-luma/nexus-luma-welcome-email.html. Each new lead
 * gets it from your Gmail account right after their row is saved.
 */

const SHEET_NAME = "Websites Leads Q4";

const EMAIL = {
  ENABLED: true,
  TEMPLATE_FILE: "WelcomeEmail",
  SUBJECT: "Welcome to Nexus Luma! Your free Business Growth Guide",
  FROM_NAME: "Nexus Luma",
  REPLY_TO: "",  // blank = replies go to the Gmail account that deployed this script
  WEBSITE_URL: "https://www.nexusluma.com",
  ASSETS_BASE_URL: "https://cdn.jsdelivr.net/gh/nexusluma365/NexusLuma-Leads@main/nexus-luma/assets",
  BROCHURE_URL: "https://raw.githubusercontent.com/nexusluma365/NexusLuma-Leads/main/public/nexus-luma-brochure.pdf",
  COMPANY_ADDRESS: "",  // physical mailing address, required by CAN-SPAM
  // Leave a profile blank to hide its icon in the footer.
  SOCIAL: { facebook: "", linkedin: "", youtube: "", instagram: "" }
};
const HEADER_ROWS = 2; // row 1 = section names, row 2 = column names

const STATUSES = [
  ["New Project Request", "#FFF59D"],
  ["Contacted",           "#BBDEFB"],
  ["Call Booked",         "#D1C4E9"],
  ["Proposal Sent",       "#FFE0B2"],
  ["Won",                 "#C8E6C9"],
  ["Lost",                "#FFCDD2"]
];

const yesNo = v => (v ? "Yes" : "No");
const attr = k => L => (L.attribution || {})[k] || "";

// Each section gets its own color: solid for the section row, medium for
// column names, light tint for the data cells underneath.
const SECTIONS = [
  { name: "SUBMISSION", solid: "#37474F", mid: "#CFD8DC", tint: "#ECEFF1", columns: [
    { header: "Lead ID",       width: 130, get: L => L.client_request_id },
    { header: "Submitted At",  width: 150, get: L => new Date(L.created_at || Date.now()), format: "mmm d, yyyy h:mm am/pm" },
    { header: "Status",        width: 160, get: L => STATUSES[0][0], status: true }
  ]},
  { name: "CONTACT INFO", solid: "#1565C0", mid: "#BBDEFB", tint: "#E3F2FD", columns: [
    { header: "First Name",        width: 120, get: L => L.first_name },
    { header: "Email",             width: 210, get: L => L.email },
    { header: "Phone",             width: 130, get: L => L.phone },
    { header: "Business Name",     width: 180, get: L => L.business_name },
    { header: "Business City/State", width: 160, get: L => L.business_location }
  ]},
  { name: "QUESTIONNAIRE ANSWERS", solid: "#2E7D32", mid: "#C8E6C9", tint: "#E8F5E9", columns: [
    { header: "Business Type",          width: 180, get: L => L.business_category_label || L.business_category },
    { header: "Business Type (Other)",  width: 160, get: L => L.business_category_other },
    { header: "Main Website Goal",      width: 250, get: L => L.primary_goal_label || L.primary_goal },
    { header: "Has a Website?",         width: 220, get: L => L.website_status_label || L.website_status },
    { header: "Current Website URL",    width: 190, get: L => L.current_website_url },
    { header: "When to Start",          width: 170, get: L => L.desired_start_label || L.desired_start },
    { header: "Help Needed",            width: 260, get: L => L.website_needs_label || L.website_needs },
    { header: "Finished Questionnaire", width: 110, get: L => yesNo(L.completed_questionnaire) }
  ]},
  { name: "PACKAGE", solid: "#6A1B9A", mid: "#E1BEE7", tint: "#F3E5F5", columns: [
    { header: "Recommended Package", width: 170, get: L => L.recommended_package_name || L.recommended_package_id },
    { header: "Selected Package",    width: 170, get: L => L.selected_package_name || L.selected_package_id },
    { header: "Price",               width: 90,  get: L => Number(L.selected_package_price) || "", format: "$#,##0" }
  ]},
  { name: "NOTES & CONSENT", solid: "#E65100", mid: "#FFE0B2", tint: "#FFF3E0", columns: [
    { header: "Notes",             width: 300, get: L => L.notes, wrap: true },
    { header: "Marketing Opt-In",  width: 110, get: L => yesNo(L.marketing_consent) }
  ]},
  { name: "TRAFFIC SOURCE", solid: "#00695C", mid: "#B2DFDB", tint: "#E0F2F1", columns: [
    { header: "UTM Source",      width: 120, get: attr("utm_source") },
    { header: "UTM Medium",      width: 120, get: attr("utm_medium") },
    { header: "UTM Campaign",    width: 150, get: attr("utm_campaign") },
    { header: "UTM Term",        width: 120, get: attr("utm_term") },
    { header: "UTM Content",     width: 120, get: attr("utm_content") },
    { header: "Google Click ID", width: 150, get: L => attr("gclid")(L) || attr("gbraid")(L) || attr("wbraid")(L) },
    { header: "Landing Page",    width: 150, get: attr("landing_page") },
    { header: "Referrer",        width: 200, get: attr("referrer") }
  ]},
  { name: "WELCOME EMAIL", solid: "#AD1457", mid: "#F8BBD0", tint: "#FCE4EC", columns: [
    { header: "Welcome Email", width: 200, get: L => "", welcome: true }
  ]}
];

const COLUMNS = SECTIONS.flatMap(s => s.columns.map(c => Object.assign({ section: s }, c)));
const STATUS_COL = COLUMNS.findIndex(c => c.status) + 1;
const WELCOME_COL = COLUMNS.findIndex(c => c.welcome) + 1;
const OPT_IN_COL = COLUMNS.findIndex(c => c.header === "Marketing Opt-In") + 1;

/* ───────── Web app ───────── */

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const lead = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!lead.client_request_id || !lead.first_name || !lead.email) {
      return json({ ok: false, error: "missing required fields" });
    }
    lock.waitLock(20000);
    const sheet = getSheet();
    if (sheet.getRange(2, 1).getValue() !== COLUMNS[0].header ||
        sheet.getMaxColumns() < COLUMNS.length ||
        sheet.getRange(2, COLUMNS.length).getValue() !== COLUMNS[COLUMNS.length - 1].header) setupSheet();

    // A retry after a dropped response sends the same ID again; don't record it twice.
    const last = sheet.getLastRow();
    if (last > HEADER_ROWS) {
      const dup = sheet.getRange(HEADER_ROWS + 1, 1, last - HEADER_ROWS, 1)
        .createTextFinder(String(lead.client_request_id)).matchEntireCell(true).findNext();
      if (dup) return json({ ok: true, id: lead.client_request_id, duplicate: true });
    }

    const row = Math.max(last, HEADER_ROWS) + 1;
    const range = sheet.getRange(row, 1, 1, COLUMNS.length);
    range.setValues([COLUMNS.map(c => clean(c.get(lead)))]);
    range.setBackgrounds([COLUMNS.map(c => c.section.tint)]);
    COLUMNS.forEach((c, i) => {
      if (c.format) sheet.getRange(row, i + 1).setNumberFormat(c.format);
    });
    sheet.getRange(row, WELCOME_COL).setValue(sendWelcomeEmail(lead));
    return json({ ok: true, id: lead.client_request_id });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const id = e && e.parameter && e.parameter.unsubscribe;
  if (id) return unsubscribe(id);
  return json({ ok: true, service: "Nexus Luma lead capture" });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Keeps visitor text from being run as a spreadsheet formula.
function clean(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date || typeof v === "number") return v;
  const s = String(v).slice(0, 2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* ───────── Welcome email ───────── */

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Sends the welcome email and returns what to show in the Welcome Email column. Never throws. */
function sendWelcomeEmail(lead) {
  if (!EMAIL.ENABLED) return "Off";
  const to = String(lead.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return "Not sent: invalid email";
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return "Not sent: daily Gmail limit reached";
    const firstName = String(lead.first_name || "").trim().slice(0, 40);
    const options = {
      to: to,
      subject: EMAIL.SUBJECT,
      name: EMAIL.FROM_NAME,
      htmlBody: renderWelcomeEmail(firstName, unsubscribeUrl(lead.client_request_id)),
      body: "Hi " + (firstName || "there") + ",\n\nWelcome to Nexus Luma! Your free Business Growth Guide is ready:\n" +
            EMAIL.BROCHURE_URL + "\n\n" + EMAIL.WEBSITE_URL
    };
    if (EMAIL.REPLY_TO) options.replyTo = EMAIL.REPLY_TO;
    MailApp.sendEmail(options);
    return "Sent " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM d, h:mm a");
  } catch (err) {
    console.error("Welcome email failed", err);
    return "Failed: " + String(err.message || err).slice(0, 150);
  }
}

function renderWelcomeEmail(firstName, unsubUrl) {
  let html = HtmlService.createTemplateFromFile(EMAIL.TEMPLATE_FILE).getRawContent();

  // Drop footer icons for profiles that aren't set, rather than leaving dead links
  Object.keys(EMAIL.SOCIAL).forEach(k => {
    if (!EMAIL.SOCIAL[k]) html = html.replace(new RegExp('<td[^>]*><a href="\\{\\{' + k + '_url\\}\\}"[\\s\\S]*?</td>'), "");
  });
  if (!EMAIL.COMPANY_ADDRESS) html = html.replace(" &middot; {{company_address}}", "");

  const assets = EMAIL.ASSETS_BASE_URL;
  const vars = {
    first_name: firstName || "there",
    website_url: EMAIL.WEBSITE_URL,
    brochure_url: EMAIL.BROCHURE_URL,
    assets_base_url: assets,
    logo_url: assets + "/nexus-luma-logo.png",
    cartoon_url: assets + "/hero-character.jpg",
    brochure_image_url: assets + "/brochure-mockup.jpg",
    unsubscribe_url: unsubUrl,
    company_address: EMAIL.COMPANY_ADDRESS,
    facebook_url: EMAIL.SOCIAL.facebook,
    linkedin_url: EMAIL.SOCIAL.linkedin,
    youtube_url: EMAIL.SOCIAL.youtube,
    instagram_url: EMAIL.SOCIAL.instagram
  };
  return html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? escHtml(vars[k]) : m));
}

function unsubscribeUrl(leadId) {
  return ScriptApp.getService().getUrl() + "?unsubscribe=" + encodeURIComponent(leadId);
}

function unsubscribe(leadId) {
  const sheet = getSheet();
  const last = sheet.getLastRow();
  const cell = last > HEADER_ROWS && sheet.getRange(HEADER_ROWS + 1, 1, last - HEADER_ROWS, 1)
    .createTextFinder(String(leadId)).matchEntireCell(true).findNext();
  if (cell) sheet.getRange(cell.getRow(), OPT_IN_COL).setValue("Unsubscribed");
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;text-align:center;color:#06143B">' +
    "<h2>You're unsubscribed.</h2><p>You won't receive marketing emails from Nexus Luma. " +
    "We'll still reply if you contact us about a project.</p></div>"
  ).setTitle("Unsubscribed");
}

/* ───────── Sheet layout ───────── */

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

/** Builds the headers, colors, widths and Status dropdown. Safe to run again. */
function setupSheet() {
  const sheet = getSheet();
  const n = COLUMNS.length;
  if (sheet.getMaxColumns() < n) sheet.insertColumnsAfter(sheet.getMaxColumns(), n - sheet.getMaxColumns());
  if (sheet.getMaxColumns() > n) sheet.deleteColumns(n + 1, sheet.getMaxColumns() - n);
  const maxRows = sheet.getMaxRows();

  // Row 1: one merged, solid-colored label per section
  sheet.getRange(1, 1, 1, n).breakApart();
  let col = 1;
  SECTIONS.forEach(s => {
    const r = sheet.getRange(1, col, 1, s.columns.length);
    if (s.columns.length > 1) r.merge();
    r.setValue(s.name).setBackground(s.solid).setFontColor("#FFFFFF")
      .setFontWeight("bold").setFontSize(11).setHorizontalAlignment("center").setVerticalAlignment("middle");
    col += s.columns.length;
  });

  // Row 2: column names
  sheet.getRange(2, 1, 1, n)
    .setValues([COLUMNS.map(c => c.header)])
    .setBackgrounds([COLUMNS.map(c => c.section.mid)])
    .setFontColor("#212121").setFontWeight("bold").setWrap(true)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(1, 30);
  sheet.setRowHeight(2, 40);

  // Data area: light tint per section, formats, widths
  const body = sheet.getRange(HEADER_ROWS + 1, 1, maxRows - HEADER_ROWS, n);
  body.setBackgrounds(Array.from({ length: maxRows - HEADER_ROWS }, () => COLUMNS.map(c => c.section.tint)))
    .setVerticalAlignment("top").setFontColor("#212121");
  COLUMNS.forEach((c, i) => {
    sheet.setColumnWidth(i + 1, c.width);
    const colRange = sheet.getRange(HEADER_ROWS + 1, i + 1, maxRows - HEADER_ROWS, 1);
    if (c.format) colRange.setNumberFormat(c.format);
    colRange.setWrap(!!c.wrap);
  });

  // White dividers between sections so each block reads as its own group
  sheet.getRange(1, 1, maxRows, n).setBorder(null, null, null, null, null, null);
  col = 1;
  SECTIONS.forEach(s => {
    col += s.columns.length;
    if (col <= n) sheet.getRange(1, col, maxRows, 1)
      .setBorder(null, true, null, null, null, null, "#FFFFFF", SpreadsheetApp.BorderStyle.SOLID_THICK);
  });
  sheet.getRange(2, 1, 1, n).setBorder(null, null, true, null, null, null, "#9E9E9E", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Status dropdown, colored by stage
  const statusRange = sheet.getRange(HEADER_ROWS + 1, STATUS_COL, maxRows - HEADER_ROWS, 1);
  statusRange.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUSES.map(s => s[0]), true).setAllowInvalid(false).build())
    .setFontWeight("bold").setHorizontalAlignment("center");
  const others = sheet.getConditionalFormatRules().filter(rule =>
    !rule.getRanges().some(r => r.getColumn() === STATUS_COL));
  sheet.setConditionalFormatRules(others.concat(STATUSES.map(([label, color]) =>
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(label)
      .setBackground(color).setRanges([statusRange]).build())));

  sheet.setFrozenRows(HEADER_ROWS);
  sheet.setFrozenColumns(3); // keep the Submission block (ID, date, status) visible while scrolling right
  sheet.setTabColor("#1565C0");
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(2, 1, maxRows - 1, n).createFilter();
}

/* ───────── Menu & testing ───────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Lead Capture")
    .addItem("Set up / reformat sheet", "setupSheet")
    .addItem("Add a test lead", "addTestLead")
    .addItem("Send test welcome email to me", "sendTestWelcomeEmail")
    .addToUi();
}

function sendTestWelcomeEmail() {
  const me = Session.getEffectiveUser().getEmail();
  const result = sendWelcomeEmail({ client_request_id: "test", first_name: "Daniel", email: me });
  SpreadsheetApp.getActiveSpreadsheet().toast(result + " → " + me, "Welcome email");
}

// Adds a sample row; the welcome email goes to your own address.
function addTestLead() {
  const res = doPost({ postData: { contents: JSON.stringify({
    client_request_id: "test-" + Utilities.getUuid().slice(0, 8),
    created_at: new Date().toISOString(),
    first_name: "Test", email: Session.getEffectiveUser().getEmail(), phone: "(555) 123-4567",
    business_name: "Sample Plumbing Co.", business_location: "Austin, TX",
    business_category: "home_services", business_category_label: "Home Services",
    primary_goal: "calls", primary_goal_label: "Get more calls and inquiries",
    website_status: "improve", website_status_label: "Yes, but it needs improvement",
    current_website_url: "sampleplumbing.com",
    desired_start: "2weeks", desired_start_label: "Within the next 2 weeks",
    website_needs: "contact", website_needs_label: "A website that helps customers contact me",
    completed_questionnaire: true,
    recommended_package_id: "connect", recommended_package_name: "Customer Connect",
    selected_package_id: "connect", selected_package_name: "Customer Connect", selected_package_price: 497,
    notes: "Test lead — safe to delete.", marketing_consent: false,
    attribution: { utm_source: "google", utm_medium: "cpc", landing_page: "/" }
  }) } });
  SpreadsheetApp.getActiveSpreadsheet().toast(res.getContent(), "Test lead");
}
