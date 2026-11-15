# CareerOps Share — Chrome Extension

**Version:** 0.1.0 (prototype, unpacked extension)  
**CareerOps request contract:** 1.0 (parity with `CareerOpsShare-Android`)  
**Status:** packaged source and core unit tests validated; interactive Chrome acceptance still required.

CareerOps Share is a **desktop job-sharing intake client**, not a CareerOps job analyzer or automatic application submitter. It captures job metadata from an explicitly selected browser tab or right-clicked link/selection, presents an editable review, and copies a structured CareerOps request. The user can then paste and submit that request in ChatGPT.

## Install locally (no Chrome Web Store account required)

1. Extract `CareerOpsShare-Chrome-v0.1.0-unpacked.zip` to a persistent folder on your computer, e.g. `D:\Dev\CareerOps\CareerOpsShare-Chrome`.
2. Open **`chrome://extensions`** in Google Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the **folder containing `manifest.json`** (not the ZIP file).
5. Pin **CareerOps Share** to your Chrome toolbar.

Chrome loads the extension locally. It is **not Chrome Web Store published** or signed as a CRX. Source-only changes require a reload on `chrome://extensions`.

## Use

### Toolbar share (review-first)
1. Open a job posting in Chrome (LinkedIn, Indeed, or another job site).
2. Optionally select the job-description text; selected text takes priority over page metadata.
3. Click the CareerOps Share icon. Review and correct job title, company, source, posting ID, URL, and description.
4. Choose **Quick Analyze**, **Build & Store**, or **Full Application**; select **CareerOps Standard** or **CareerOps JSON**.
5. Click **Copy request**, or **Copy + Open ChatGPT**. **Paste and send it yourself** in ChatGPT.

### Right-click share
Right-click **a job page**, **selected job-description text**, or **a job posting link** and choose a CareerOps action from the context menu. A full-page editor opens. Clicking a link captures the **link target** rather than the surrounding listing page. If extraction is restricted, paste the description manually.

### Saved defaults
The **Save defaults** button persists the selected action and output format. It does not save job postings, credentials, or request contents. Right-click actions override the saved action only for that capture.

## Action contract

| Shortcut | Action ID | Requested outcome |
| --- | --- | --- |
| Quick Analyze | `ANALYZE` | CareerOps fit analysis |
| Build & Store | `ANALYZE_BUILD_STORE` | Fit + resume DOCX/PDF + verified storage |
| Full Application | `ANALYZE_BUILD_STORE_COVER_LETTER` | Fit + resume and cover letter, both DOCX/PDF + verified storage |

The build actions carry explicit instructions. **The extension itself does not generate, store, or validate a resume/letter**: those outcomes depend on the receiving CareerOps execution environment. No action authorizes application submission. Unsupported artifact/storage steps must be reported as **PARTIAL**.

## Security and privacy

- Manifest V3; **no persistent website host permissions**, no credentials, no provider authentication.
- Tab page-content access is temporary (`activeTab` + `scripting`) when you invoke the extension; not continuous browsing surveillance.
- No `fetch`, API/webhook submission, telemetry, background scraping, or automatic job/application submission.
- Current job captures live only in the review UI or ephemeral `chrome.storage.session` for right-click handoff. Only user-selected action/format defaults live in `chrome.storage.local`.
- Posting URL sanitization removes tracking parameters and common credential-like query parameters; **review source content before sending**, especially proprietary posting text.
- Chrome does not permit script injection into restricted pages (e.g., internal browser pages); the user can paste text instead.
- ChatGPT handoff copies the text to the **system clipboard** and opens `https://chatgpt.com/`. It **does not** automatically paste, switch a model, or send a message.
- No remotely hosted executable JavaScript.

## Development and tests

Requires Node.js 20+ for tests; **no npm dependencies or installation step**:

```powershell
cd D:\Dev\CareerOps\CareerOpsShare-Chrome
npm run check
python scripts\package.py --out-dir dist
```

`npm run check` parses all JavaScript files and runs the Node built-in test suite. `scripts/package.py --out-dir dist` builds a runtime-only `unpacked.zip` plus a separate source archive and SHA-256 manifests inside `dist/`. The workflow uses only self-hosted LocalCI labels, and never automatically runs untrusted public-fork PRs. If Python Playwright and Chromium are available, `tests/browser_smoke.py` provides an optional browser smoke test; it is **not** part of the required release gate until consistently operational in the target LocalCI environment.

## Integration boundaries

- **Android client:** `DantyDCook/CareerOpsShare-Android` — shares the CareerOps v1.0 request contract.
- **Domain/runtime:** `DantyDCook/CareerOps-Engine` — owns job retrieval, fit analysis, evidence and artifact workflows.
- **Private state:** `DantyDCook/CareerOps-Workspace` — canonical application and artifact state, accessed only through approved Engine contracts.
- **Program system of record:** `DantyDCook/CareerOps` — tracks the new Chrome component and its dependencies.

See `docs/ROADMAP.md` and `docs/LOCALCI.md`.
