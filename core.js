/**
 * CareerOps Share request contract v1.0.
 * Pure functions: no Chrome APIs, provider logins, or network access.
 */
export const SCHEMA_VERSION = '1.0';
export const MAX_CONTENT_CHARS = 100_000;

export const ACTIONS = Object.freeze({
  'quick-analyze': 'ANALYZE',
  'build-store': 'ANALYZE_BUILD_STORE',
  'full-application': 'ANALYZE_BUILD_STORE_COVER_LETTER',
});

const SOURCES = [
  ['linkedin.com', 'LinkedIn', 'linkedin'],
  ['indeed.com', 'Indeed', 'indeed'],
  ['glassdoor.com', 'Glassdoor', 'glassdoor'],
  ['ziprecruiter.com', 'ZipRecruiter', 'ziprecruiter'],
  ['monster.com', 'Monster', 'monster'],
];

const TRACKING_KEYS = new Set(['gclid', 'fbclid', 'msclkid', 'mc_cid', 'mc_eid']);
const SECRET_KEYS = new Set([
  'access_token', 'id_token', 'refresh_token', 'token', 'auth', 'auth_token',
  'authorization', 'client_secret', 'session', 'sessionid', 'api_key', 'apikey',
  'signature', 'sig', 'code', 'password', 'passwd', 'secret', 'jwt',
]);
const PROVIDER_TRACKING = {
  linkedin: new Set(['trackingid', 'refid', 'trk', 'lipi', 'midtoken', 'mid', 'epp', 'recommendedflavor']),
  indeed: new Set(['from', 'fromage', 'vjs', 'advn', 'aceid']),
};

/** Only HTTP(S) URLs are accepted, never javascript:, chrome:, file:, etc. */
export function parseWebUrl(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  try {
    const url = new URL(input.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!url.hostname || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function detectSource(input) {
  const url = parseWebUrl(input);
  if (!url) return { source: 'Shared text', sourceId: 'shared_text' };
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  for (const [domain, source, sourceId] of SOURCES) {
    if (hostname === domain || hostname.endsWith('.' + domain)) return { source, sourceId };
  }
  return { source: hostname.replace(/^www\./, ''), sourceId: hostname.replace(/^www\./, '') };
}

export function extractJobId(input, sourceId = detectSource(input).sourceId) {
  const url = parseWebUrl(input);
  if (!url) return null;
  if (sourceId === 'linkedin') {
    const match = url.pathname.match(/\/jobs\/view\/(\d{6,})(?:\/|$)/);
    if (match) return match[1];
    const fromSearch = url.searchParams.get('currentJobId');
    return fromSearch && /^\d{6,}$/.test(fromSearch) ? fromSearch : null;
  }
  if (sourceId === 'indeed') {
    const jk = url.searchParams.get('jk');
    return jk && /^[a-z0-9-]{6,64}$/i.test(jk) ? jk : null;
  }
  return null;
}

/** Removes provider tracking and obvious credential-like query parameters. */
export function sanitizeUrl(input, sourceId = detectSource(input).sourceId) {
  const url = parseWebUrl(input);
  if (!url) return null;
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith('utm_') || TRACKING_KEYS.has(normalized) ||
        SECRET_KEYS.has(normalized) || PROVIDER_TRACKING[sourceId]?.has(normalized)) {
      url.searchParams.delete(key);
    }
  }
  url.hash = '';
  return url.toString();
}

export function canonicalizeUrl(input) {
  const url = parseWebUrl(input);
  if (!url) return null;
  const { sourceId } = detectSource(url.toString());
  const jobId = extractJobId(url.toString(), sourceId);
  if (sourceId === 'linkedin' && jobId) return `https://www.linkedin.com/jobs/view/${jobId}/`;
  if (sourceId === 'indeed' && jobId) return `https://www.indeed.com/viewjob?jk=${jobId}`;
  return sanitizeUrl(url.toString(), sourceId);
}

/** URL-based metadata that can be refreshed whenever the job URL is edited. */
export function inferJobMetadata(urlInput) {
  const canonicalUrl = canonicalizeUrl(urlInput);
  const { source, sourceId } = detectSource(canonicalUrl);
  return { source, sourceId, jobId: extractJobId(canonicalUrl, sourceId) || '' };
}

function limited(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Assemble an editable draft from explicitly requested page/selection capture. */
export function captureToDraft(capture = {}) {
  const originalUrl = sanitizeUrl(capture.pageUrl || '');
  const canonicalUrl = canonicalizeUrl(capture.pageUrl || '');
  const { source, sourceId } = detectSource(canonicalUrl);
  const title = limited(capture.jobTitle || capture.title, 240);
  const company = limited(capture.company, 240);
  const description = limited(capture.selectedText || capture.description || '', MAX_CONTENT_CHARS);
  const wasTruncated = Boolean(capture.wasTruncated ||
    (typeof (capture.selectedText || capture.description) === 'string' &&
      (capture.selectedText || capture.description).trim().length > MAX_CONTENT_CHARS));
  return {
    subject: title,
    company,
    description,
    source,
    sourceId,
    jobId: extractJobId(canonicalUrl, sourceId) || '',
    originalUrl: originalUrl || '',
    canonicalUrl: canonicalUrl || '',
    // Baseline lets downstream requests distinguish inferred metadata from explicit edits.
    identityUrl: canonicalUrl || '',
    sourceOverride: false,
    jobIdOverride: false,
    wasTruncated,
  };
}

function optional(value) { return limited(value, MAX_CONTENT_CHARS) || null; }

export function actionInstructions(action) {
  if (action === ACTIONS['quick-analyze']) return null;
  if (![ACTIONS['build-store'], ACTIONS['full-application']].includes(action)) {
    throw new Error('Unsupported CareerOps action');
  }
  const lines = [
    'Execute the requested CareerOps application-artifact workflow, not just a cover-letter draft.',
    '- Retrieve the job posting, perform the fit analysis, and select only validated CareerOps evidence.',
    '- Build a job-tailored, ATS-readable resume and render BOTH DOCX and PDF.',
  ];
  if (action === ACTIONS['full-application']) {
    lines.push('- Build a matching, evidence-grounded cover letter and render BOTH DOCX and PDF.');
  }
  lines.push(
    '- Review the requested documents for factual accuracy, job relevance, and rendering defects.',
    '- Store and verify the outputs in the configured CareerOps Workspace and artifact store (e.g., Google Drive), where accessible and authorized.',
    '- Return a fulfillment report with the fit result, document status, and real artifact locations or links.',
    'Mark the package PARTIAL if any required document, format, or persistence verification is missing; identify each blocker. Never claim a file was created or stored without verification.',
    'Do not submit the application or change an external application account without separate explicit authorization.'
  );
  return lines.join('\n');
}

export function createRequest(draft, action = ACTIONS['quick-analyze']) {
  if (!Object.values(ACTIONS).includes(action)) throw new Error('Unsupported CareerOps action');
  if (!draft || typeof draft !== 'object') throw new Error('Missing job draft');
  const canonicalUrl = canonicalizeUrl(draft.canonicalUrl) || null;
  const originalUrl = sanitizeUrl(draft.originalUrl) || null;
  // An edited canonical URL invalidates metadata inferred for the original posting.
  // Explicit edits after a URL change can still override the inferred source or ID.
  const inferred = inferJobMetadata(canonicalUrl || originalUrl);
  const originalIdentityUrl = canonicalizeUrl(draft.identityUrl ?? draft.originalUrl) || null;
  const urlChanged = canonicalUrl !== originalIdentityUrl;
  const source = (urlChanged && !draft.sourceOverride)
    ? inferred.source : limited(draft.source, 180) || inferred.source;
  const sourceId = source === inferred.source ? inferred.sourceId :
    draft.sourceOverride ? source.toLowerCase().replace(/\s+/g, '_') :
      limited(draft.sourceId, 180) || source.toLowerCase().replace(/\s+/g, '_');
  const jobId = (urlChanged && !draft.jobIdOverride)
    ? inferred.jobId || null
    : limited(draft.jobId, 140) || inferred.jobId || null;
  const subject = optional(draft.subject);
  const company = optional(draft.company);
  const desc = limited(draft.description, MAX_CONTENT_CHARS);
  const sections = [subject, company ? `Company: ${company}` : null, desc, canonicalUrl].filter(Boolean);
  const combined = sections.join('\n\n');
  const wasTruncated = Boolean(draft.wasTruncated || combined.length > MAX_CONTENT_CHARS ||
    (typeof draft.description === 'string' && draft.description.trim().length > MAX_CONTENT_CHARS));
  return {
    schema_version: SCHEMA_VERSION,
    action,
    job: {
      source,
      source_id: sourceId,
      job_id: jobId,
      original_url: originalUrl,
      canonical_url: canonicalUrl,
      subject,
      was_truncated: wasTruncated,
      raw_shared_content: combined.slice(0, MAX_CONTENT_CHARS),
    },
  };
}

export function renderStandard(request) {
  const j = request.job;
  const lines = [
    'Analyze this job using CareerOps:',
    '',
    'CAREEROPS_REQUEST',
    `schema_version: ${request.schema_version}`,
    `action: ${request.action}`,
    `source: ${j.source}`,
    `source_id: ${j.source_id}`,
    `job_id: ${j.job_id ?? 'unknown'}`,
    `canonical_url: ${j.canonical_url ?? 'none'}`,
  ];
  const instructions = actionInstructions(request.action);
  if (instructions) lines.push('', 'Execution requirements:', instructions);
  lines.push('', 'Shared content:', j.raw_shared_content || j.canonical_url || '');
  return lines.join('\n').trimEnd();
}

export function renderJson(request) {
  const instructions = actionInstructions(request.action);
  return JSON.stringify({
    schema_version: request.schema_version,
    action: request.action,
    ...(instructions ? { execution_instructions: instructions } : {}),
    job: request.job,
  }, null, 2);
}

export function renderRequest(request, profile = 'careerops_standard') {
  if (profile === 'careerops_standard') return renderStandard(request);
  if (profile === 'careerops_json') return renderJson(request);
  throw new Error('Unsupported request profile');
}
