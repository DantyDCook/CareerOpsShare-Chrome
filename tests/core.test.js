import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, SCHEMA_VERSION, MAX_CONTENT_CHARS, parseWebUrl, detectSource,
  extractJobId, sanitizeUrl, canonicalizeUrl, captureToDraft, inferJobMetadata, createRequest,
  renderRequest, actionInstructions,
} from '../core.js';

test('request schema and three actions preserve the Android contract', () => {
  assert.equal(SCHEMA_VERSION, '1.0');
  assert.deepEqual(Object.values(ACTIONS), [
    'ANALYZE', 'ANALYZE_BUILD_STORE', 'ANALYZE_BUILD_STORE_COVER_LETTER',
  ]);
});

test('LinkedIn URL canonicalization drops tracking and preserves posting ID', () => {
  const url = 'https://www.linkedin.com/jobs/view/4489850521/?trackingId=abc&refId=def';
  assert.equal(detectSource(url).sourceId, 'linkedin');
  assert.equal(extractJobId(url), '4489850521');
  assert.equal(canonicalizeUrl(url), 'https://www.linkedin.com/jobs/view/4489850521/');
});

test('LinkedIn listing uses currentJobId when no path ID is present', () => {
  assert.equal(canonicalizeUrl('https://www.linkedin.com/jobs/search/?keywords=data&currentJobId=4489850521'),
    'https://www.linkedin.com/jobs/view/4489850521/');
});

test('Indeed URL uses jk and strips share parameters', () => {
  assert.equal(canonicalizeUrl('https://www.indeed.com/viewjob?jk=4fbfcf9afb5cbb7e&from=appshareandroid'),
    'https://www.indeed.com/viewjob?jk=4fbfcf9afb5cbb7e');
});

test('unrecognized hosts preserve job parameters but strip tracking and secret tokens', () => {
  const url = 'https://careers.example.org/jobs?req=JR134981&utm_medium=email&token=secret#details';
  assert.equal(canonicalizeUrl(url), 'https://careers.example.org/jobs?req=JR134981');
});

test('source classification rejects host impersonation', () => {
  assert.equal(detectSource('https://linkedin.com.attacker.example/jobs/view/123456').sourceId,
    'linkedin.com.attacker.example');
  assert.equal(detectSource('https://notlinkedin.com/jobs/view/123456').source, 'notlinkedin.com');
});

test('unsafe and credential-bearing URLs never enter the request', () => {
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'chrome://extensions',
    'https://alice:password@example.com/job', 'data:text/html,<h1>x</h1>']) {
    assert.equal(parseWebUrl(url), null);
    assert.equal(canonicalizeUrl(url), null);
  }
});

test('explicit selection takes priority over metadata description', () => {
  const d = captureToDraft({pageUrl:'https://jobs.example/jobs/123',jobTitle:'Data Analyst',
    company:'Example', selectedText:'SELECTED', description:'OTHER'});
  assert.equal(d.description, 'SELECTED');
  const request = createRequest(d);
  assert.match(request.job.raw_shared_content, /SELECTED/);
  assert.doesNotMatch(request.job.raw_shared_content, /OTHER/);
  assert.match(request.job.raw_shared_content, /Company: Example/);
});

test('truncates capture and declares was_truncated', () => {
  const draft = captureToDraft({pageUrl:'https://example.org/jobs/1', description:'x'.repeat(110_000)});
  assert.equal(draft.wasTruncated, true);
  assert.equal(draft.description.length, MAX_CONTENT_CHARS);
  const request = createRequest(draft);
  assert.equal(request.job.was_truncated, true);
  assert.ok(request.job.raw_shared_content.length <= MAX_CONTENT_CHARS);
});

test('standard text matches Android compatibility headers', () => {
  const draft = captureToDraft({pageUrl:'https://www.linkedin.com/jobs/view/4489850521/', jobTitle:'Analyst'});
  const rendered = renderRequest(createRequest(draft, ACTIONS['quick-analyze']));
  assert.ok(rendered.startsWith('Analyze this job using CareerOps:\n\nCAREEROPS_REQUEST\n'));
  assert.match(rendered, /schema_version: 1\.0/);
  assert.match(rendered, /action: ANALYZE/);
  assert.match(rendered, /job_id: 4489850521/);
  assert.match(rendered, /Shared content:/);
  assert.doesNotMatch(rendered, /Execution requirements:/);
});

test('build-store requires DOCX/PDF resume and verified storage', () => {
  const instructions = actionInstructions(ACTIONS['build-store']);
  assert.match(instructions, /resume and render BOTH DOCX and PDF/);
  assert.match(instructions, /Store and verify/);
  assert.doesNotMatch(instructions, /matching, evidence-grounded cover letter/);
});

test('full application requires both document types, partial honesty, no submission', () => {
  const draft = captureToDraft({pageUrl:'https://www.indeed.com/viewjob?jk=4fbfcf9afb5cbb7e'});
  const rendered = renderRequest(createRequest(draft, ACTIONS['full-application']));
  assert.match(rendered, /matching, evidence-grounded cover letter and render BOTH DOCX and PDF/);
  assert.match(rendered, /Mark the package PARTIAL/);
  assert.match(rendered, /Do not submit the application/);
});

test('JSON profile retains exact logical job fields and optional instructions', () => {
  const draft = captureToDraft({pageUrl:'https://www.indeed.com/viewjob?jk=4fbfcf9afb5cbb7e',
    title:'Data Analyst', company:'Acme', description:'SQL'});
  const analysis = JSON.parse(renderRequest(createRequest(draft), 'careerops_json'));
  assert.deepEqual(Object.keys(analysis), ['schema_version', 'action', 'job']);
  assert.deepEqual(Object.keys(analysis.job), [
    'source', 'source_id', 'job_id', 'original_url', 'canonical_url',
    'subject', 'was_truncated', 'raw_shared_content',
  ]);
  assert.equal(analysis.job.source_id, 'indeed');
  assert.equal(analysis.job.job_id, '4fbfcf9afb5cbb7e');
  assert.equal(analysis.job.was_truncated, false);
  const full = JSON.parse(renderRequest(createRequest(draft, ACTIONS['full-application']), 'careerops_json'));
  assert.equal(full.execution_instructions.includes('cover letter'), true);
});

test('missing URL still supports user-pasted content', () => {
  const draft = captureToDraft({description:'SQL Engineer, remote'});
  const r = createRequest(draft);
  assert.equal(r.job.source_id, 'shared_text');
  assert.equal(r.job.canonical_url, null);
  assert.match(r.job.raw_shared_content, /SQL Engineer, remote/);
});

test('rejects unsupported actions and output formats', () => {
  assert.throws(() => createRequest({}, 'SUBMIT_APPLICATION'), /Unsupported/);
  assert.throws(() => renderRequest(createRequest({description:'x'}), 'xml'), /Unsupported/);
});


test('editing LinkedIn URL to Indeed updates inferred source and ID', () => {
  const draft = captureToDraft({pageUrl:'https://www.linkedin.com/jobs/view/4489850521/',jobTitle:'Old role'});
  draft.canonicalUrl = 'https://www.indeed.com/viewjob?jk=4fbfcf9afb5cbb7e';
  const job = createRequest(draft).job;
  assert.equal(job.source, 'Indeed');
  assert.equal(job.source_id, 'indeed');
  assert.equal(job.job_id, '4fbfcf9afb5cbb7e');
  assert.equal(job.canonical_url, 'https://www.indeed.com/viewjob?jk=4fbfcf9afb5cbb7e');
});

test('pasting a URL after restricted capture correctly derives a posting identity', () => {
  const draft = captureToDraft({description:'Data Analyst'});
  draft.canonicalUrl = 'https://www.linkedin.com/jobs/view/4489850521/';
  const job = createRequest(draft).job;
  assert.equal(job.source_id, 'linkedin');
  assert.equal(job.job_id, '4489850521');
});

test('manual source and ID overrides are preserved after URL change when explicit', () => {
  const draft = captureToDraft({pageUrl:'https://www.linkedin.com/jobs/view/4489850521/'});
  draft.canonicalUrl = 'https://ats.example.com/apply/position';
  draft.source='ATS Example'; draft.jobId='REQ-4567';
  draft.sourceOverride=true; draft.jobIdOverride=true;
  const job=createRequest(draft).job;
  assert.equal(job.source, 'ATS Example');
  assert.equal(job.source_id, 'ats_example');
  assert.equal(job.job_id, 'REQ-4567');
});

test('inferred metadata can be used to reset visible source and ID on each URL edit', () => {
  const metadata = inferJobMetadata('https://www.indeed.com/viewjob?jk=4fbfcf9afb5cbb7e');
  assert.deepEqual(metadata, {source:'Indeed',sourceId:'indeed',jobId:'4fbfcf9afb5cbb7e'});
  assert.deepEqual(inferJobMetadata(''), {source:'Shared text',sourceId:'shared_text',jobId:''});
});
