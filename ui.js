import { ACTIONS, captureToDraft, createRequest, renderRequest, inferJobMetadata, MAX_CONTENT_CHARS } from './core.js';

const byId = (id) => document.getElementById(id);
const form = byId('shareForm');
let draft = captureToDraft({});
const ACTION_IDS = new Set(Object.values(ACTIONS));

function notice(message, kind = '') {
  const el = byId('notice');
  el.textContent = message;
  el.className = 'notice ' + kind;
}

function readForm() {
  const data = new FormData(form);
  return {
    subject: String(data.get('subject') || ''),
    company: String(data.get('company') || ''),
    description: String(data.get('description') || ''),
    source: String(data.get('source') || ''),
    jobId: String(data.get('jobId') || ''),
    canonicalUrl: String(data.get('canonicalUrl') || ''),
    sourceId: draft.sourceId,
    originalUrl: draft.originalUrl,
    identityUrl: draft.identityUrl,
    sourceOverride: draft.sourceOverride,
    jobIdOverride: draft.jobIdOverride,
    wasTruncated: draft.wasTruncated,
  };
}

function requestText() {
  const action = String(new FormData(form).get('action') || ACTIONS['quick-analyze']);
  const profile = byId('profile').value;
  if (!ACTION_IDS.has(action)) throw new Error('Unknown CareerOps action');
  return renderRequest(createRequest(readForm(), action), profile);
}

function updatePreview() {
  try {
    const message = requestText();
    byId('preview').textContent = message;
  } catch (error) {
    byId('preview').textContent = 'Cannot build request: ' + error.message;
  }
}

function setAction(action) {
  const input = form.querySelector(`input[name="action"][value="${action}"]`);
  if (input) input.checked = true;
}

function populate(next) {
  draft = {...next};
  for (const id of ['subject', 'company', 'description', 'source', 'jobId', 'canonicalUrl']) {
    byId(id).value = draft[id] || '';
  }
  updatePreview();
}

async function captureActivePage() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  } catch (error) {
    notice('Unable to access the active tab: ' + error.message, 'error');
    return;
  }
  if (!tab) {
    notice('No active browser tab. Paste a job URL or description.', 'error');
    return;
  }
  let captured = {pageUrl: tab.url || '', title: tab.title || ''};
  try {
    const results = await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['capture.js']});
    if (results?.[0]?.result) captured = results[0].result;
    notice('Page captured. Review the extracted fields before copying.', 'success');
  } catch {
    notice('Page content is restricted or unavailable. URL/title only; you may paste the description.', 'error');
  }
  populate(captureToDraft(captured));
  if (captured.description?.length >= MAX_CONTENT_CHARS || captured.wasTruncated) {
    notice('Captured text was truncated at 100,000 characters. Review carefully.', 'error');
  }
}

async function copyRequest(openChatGPT) {
  let payload;
  try { payload = requestText(); } catch (error) { notice(error.message, 'error'); return; }
  if (!readForm().canonicalUrl.trim() && !readForm().description.trim()) {
    notice('Add a job URL or description before copying.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(payload);
  } catch {
    notice('Clipboard unavailable. Expand “Review generated request” to select/copy manually.', 'error');
    return;
  }
  if (openChatGPT) {
    try {
      await chrome.tabs.create({url: 'https://chatgpt.com/'});
      notice('Copied request and opened ChatGPT. Paste and submit it there.', 'success');
    } catch (error) {
      notice('Request copied. Opening ChatGPT failed: ' + error.message, 'error');
    }
  } else {
    notice('CareerOps request copied. Paste it into your selected destination.', 'success');
  }
}

async function loadStaged() {
  const staged = new URLSearchParams(location.search).get('staged');
  if (!staged || !/^[\da-f-]{36}$/i.test(staged)) return false;
  const key = 'stage:' + staged;
  try {
    const record = (await chrome.storage.session.get(key))[key];
    await chrome.storage.session.remove(key);
    if (!record) return false;
    populate(captureToDraft(record.capture));
    if (ACTIONS[record.preset]) setAction(ACTIONS[record.preset]);
    updatePreview();
    notice('Right-click capture loaded. Review before sending.', 'success');
    return true;
  } catch {
    return false;
  }
}

async function initialize() {
  try {
    const prefs = (await chrome.storage.local.get('preferences')).preferences || {};
    if (ACTION_IDS.has(prefs.action)) setAction(prefs.action);
    if (['careerops_standard', 'careerops_json'].includes(prefs.profile)) byId('profile').value = prefs.profile;
  } catch { /* Preferences are optional. */ }
  if (!(await loadStaged())) await captureActivePage();
}

form.addEventListener('input', (event) => {
  if (event.target.id === 'canonicalUrl') {
    // Reset previously inferred values (and stale manual overrides) on URL edits.
    const metadata = inferJobMetadata(event.target.value);
    byId('source').value = metadata.source;
    byId('jobId').value = metadata.jobId;
    draft.sourceId = metadata.sourceId;
    draft.sourceOverride = false;
    draft.jobIdOverride = false;
  } else if (event.target.id === 'source') {
    draft.sourceOverride = true;
  } else if (event.target.id === 'jobId') {
    draft.jobIdOverride = true;
  }
  updatePreview();
});
form.addEventListener('change', updatePreview);
form.addEventListener('submit', (event) => event.preventDefault());
byId('recapture').addEventListener('click', captureActivePage);
byId('copy').addEventListener('click', () => copyRequest(false));
byId('copyOpen').addEventListener('click', () => copyRequest(true));
byId('saveDefaults').addEventListener('click', async () => {
  const action = String(new FormData(form).get('action'));
  const profile = byId('profile').value;
  if (!ACTION_IDS.has(action)) { notice('Invalid action.', 'error'); return; }
  try {
    await chrome.storage.local.set({preferences: {action, profile}});
    notice('Action and request format saved as defaults.', 'success');
  } catch (error) {
    notice('Could not save defaults: ' + error.message, 'error');
  }
});

initialize().catch((error) => notice('Initialization failed: ' + error.message, 'error'));
