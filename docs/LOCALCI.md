# LocalCI integration / readiness

**Target project:** CareerOpsShare-Chrome  
**Runner target:** LocalCI (existing 3-slot Windows/self-hosted pool), **not GitHub-hosted runners**.

v0.1 has no package manager install or remote build dependencies. The acceptance contract for onboarding:

1. Check out a pinned source revision into an isolated LocalCI worktree or clean source archive.
2. Run `node --version` (20+) and `npm run check`.
3. Run `python scripts/package.py` to generate the two archive outputs and SHA-256 report.
4. Verify no network/API permissions were added to `manifest.json` and no remote scripts appeared.
5. Run browser smoke validation on a **real Chrome or supported headed Chromium environment**, including context-menu capture, where available; mark browser/device coverage **NOT VERIFIED** if unavailable.
6. Archive the exact source revision, test result, `CareerOpsShare-Chrome-v0.1.0-unpacked.zip`, source ZIP, and `SHA256SUMS.txt` using LocalCI output-archive validation.
7. Keep release and Web Store publishing **disabled** until manual Chrome acceptance is recorded and an authorized release gate is approved.

Do **not** add `runs-on: ubuntu-latest`, GitHub-hosted Android runners, or background publishers to this project. LocalCI controller and artifact/archive behavior is managed by its separate system-of-record; this file does not claim those integrations are currently working.
