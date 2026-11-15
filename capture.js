/* Injected only when the user invokes the extension on the active page. */
(() => {
  const text = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
  const MAX = 100_000;
  const bodyText = (value) => typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n[ \t]*\n+/g, '\n\n').trim() : '';
  const bySelector = (selectors) => {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const content = bodyText(el?.innerText || el?.textContent);
      if (content.length > 80) return content;
    }
    return '';
  };
  const meta = (selectors) => {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute('content');
      if (value) return text(value);
    }
    return '';
  };
  const htmlAsText = (value) => {
    if (typeof value !== 'string') return '';
    try {
      const withBreaks = value.replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|li|div|h[1-6]|section|article)>/gi, '\n');
      return bodyText(new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent);
    } catch { return text(value.replace(/<[^>]*>/g, ' ')); }
  };
  let structured = null;
  const findPosting = (obj, depth = 0) => {
    if (!obj || depth > 6) return null;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = findPosting(item, depth + 1);
        if (result) return result;
      }
      return null;
    }
    if (typeof obj !== 'object') return null;
    const type = obj['@type'];
    if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return obj;
    return findPosting(obj['@graph'], depth + 1);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      structured = findPosting(JSON.parse(script.textContent));
      if (structured) break;
    } catch { /* Ignore malformed site JSON-LD. */ }
  }
  const selectedText = bodyText(window.getSelection()?.toString() || '');
  const description = selectedText || htmlAsText(structured?.description) || bySelector([
    '[data-testid="jobDescriptionText"]',
    '#jobDescriptionText',
    '#jobDescription',
    '[data-testid="jobsearch-JobComponent-description"]',
    '.jobs-description__content',
    '.show-more-less-html__markup',
    '[itemprop="description"]',
  ]);
  const company = typeof structured?.hiringOrganization === 'string'
    ? structured.hiringOrganization : structured?.hiringOrganization?.name;
  const jobTitle = text(structured?.title || meta([
    'meta[property="og:title"]', 'meta[name="twitter:title"]',
  ]) || document.title);
  const output = {
    pageUrl: location.href,
    title: text(document.title).slice(0, 240),
    jobTitle: jobTitle.slice(0, 240),
    company: text(company || '').slice(0, 240),
    selectedText: selectedText.slice(0, MAX),
    description: description.slice(0, MAX),
    wasTruncated: selectedText.length > MAX || description.length > MAX,
  };
  return output;
})()
