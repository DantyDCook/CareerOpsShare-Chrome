# CareerOps Share Chrome — Roadmap

## v0.1.0 — Review-first local MVP (this package)
- [x] Chrome Manifest V3 scaffold, icons, toolbar popup
- [x] Context-menu capture for job page, selection, and right-click job link
- [x] Scoped activeTab extraction (JSON-LD, known description selectors, fallback URL/title)
- [x] LinkedIn/Indeed canonical IDs + safe generic URL normalization
- [x] Editable job metadata, description, standard-text/JSON preview
- [x] Three CareerOps-compatible action presets and explicit artifact instructions
- [x] Save default action and format only; ephemeral right-click captures
- [x] Copy-only and Copy + Open ChatGPT
- [x] Unit/static tests (Node; no third-party packages)
- [ ] **Real Chrome browser acceptance on Windows** (popup, context menu, link vs selection, restricted-page fallback, clipboard)
- [ ] **LocalCI job registration and verified run** (depends on ongoing LocalCI migration/repository onboarding)
- [x] **Dedicated GitHub repo** (`DantyDCook/CareerOpsShare-Chrome`) created
- [x] v0.1.0 source imported onto feature branch for review
- [ ] Merge PR after review and accept first LocalCI run
- [ ] Cross-repo integration issue/PR and component registry update after repository creation

## v0.2.0 — Improved desktop intake
- [ ] Multiple editable/custom user presets, consistent with Android Quick Share profile semantics
- [ ] Improve LinkedIn/Indeed/Glassdoor/ZipRecruiter/Monster extraction with fixtures and platform regression tests
- [ ] Explicit full-page text capture toggle with size disclosure (never silent bulk scraping)
- [ ] Optional local history, **opt-in** and bounded storage/retention
- [ ] Accessible keyboard navigation, high contrast, theme controls, help and error UX
- [ ] Browser-tested ZIP + reproducible versioned release checksums

## v0.3.0 — Secure CareerOps Gateway (only after Engine contract exists)
- [ ] Authenticated HTTPS request transport behind explicit user opt-in
- [ ] Credential handling through approved broker, not hard-coded tokens or copied browser cookies
- [ ] Submission acknowledgments/status, request IDs, retries and deduplication
- [ ] Model preference routing **only** when service confirms supported capability
- [ ] Clear remote-data privacy policy and permissions review prior to Web Store consideration

## Non-goals / hard boundaries
- No scraping behind CAPTCHA/MFA, bypassing site access controls, or harvesting browser session data.
- No silent application submission or user account modification.
- No direct writes to CareerOps Workspace outside Engine contracts.
- No claims that a copied prompt is a finished application artifact.
- No use of GitHub-hosted CI for main project builds while LocalCI migration is in progress.
