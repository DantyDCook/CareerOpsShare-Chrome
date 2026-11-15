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

## Workflow registration in this repository

`.github/workflows/localci.yml` provides a Linux self-hosted checkout, Node tests, Python package build, SHA-256 verification, and GitHub artifact upload. Its runner labels match the confirmed LocalCI bootstrap acceptance workflow: `self-hosted`, `linux`, `x64`, `local-ci`, `hyperv-ci`. The workflow is deliberately **push-to-main / manual only** (no `pull_request` event): this is a public repo, and untrusted fork code must never execute automatically on the private self-hosted runner. New feature branches are reviewed before merge; LocalCI execution after merge is a separate verification gate.

The workflow file does not register this repository with the LocalCI controller. Controller-side admission, artifact-archive reconciliation, signed release gates, and Chrome device acceptance still require independent verification.

Run locally before review:

```bash
npm run check
python3 scripts/package.py --out-dir dist
(cd dist && sha256sum -c CareerOpsShare-Chrome-SHA256SUMS.txt)
```
