"""Optional real Chromium smoke test; requires Python playwright and a Chromium executable."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
FIXTURE='''<!doctype html><title>Example job</title>
<h1>Data Analyst</h1>
<script type="application/ld+json">{"@context":"https://schema.org", "@type":"JobPosting", "title":"Data Analyst", "hiringOrganization":{"name":"ExampleWorks"}, "description":"<p>SQL, Python, analytics</p><p>Remote US</p>"}</script>
'''

def run(chromium_path, capture_screenshot=None):
    fixture_dir=ROOT/'tests'/'fixture'
    fixture_dir.mkdir(exist_ok=True)
    (fixture_dir/'job.html').write_text(FIXTURE)
    handler=functools.partial(SimpleHTTPRequestHandler, directory=str(fixture_dir))
    server=ThreadingHTTPServer(('127.0.0.1', 0),handler)
    thread=Thread(target=server.serve_forever,daemon=True)
    thread.start()
    import tempfile
    with tempfile.TemporaryDirectory() as profile, sync_playwright() as p:
        ctx=p.chromium.launch_persistent_context(profile, executable_path=chromium_path,headless=True,
            args=[f'--disable-extensions-except={ROOT}',f'--load-extension={ROOT}','--no-sandbox'])
        try:
            worker=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker',timeout=15000)
            ext_id=worker.url.split('/')[2]
            tab=ctx.new_page()
            tab.goto(f'http://127.0.0.1:{server.server_port}/job.html')
            capture=tab.evaluate((ROOT/'capture.js').read_text())
            assert capture['jobTitle']=='Data Analyst', capture
            assert capture['company']=='ExampleWorks', capture
            assert 'analytics' in capture['description'], capture
            tab.close()
            popup=ctx.new_page()
            popup.goto(f'chrome-extension://{ext_id}/popup.html')
            popup.wait_for_selector('#shareForm')
            popup.locator('#subject').fill('Data Analyst')
            popup.locator('#company').fill('ExampleWorks')
            popup.locator('#canonicalUrl').fill('https://www.linkedin.com/jobs/view/4489850521/')
            popup.locator('#description').fill('SQL and Python')
            popup.locator('input[name="action"][value="ANALYZE_BUILD_STORE_COVER_LETTER"]').check()
            popup.locator('details summary').click()
            preview=popup.locator('#preview').inner_text()
            assert 'ANALYZE_BUILD_STORE_COVER_LETTER' in preview, preview
            assert 'cover letter and render BOTH DOCX and PDF' in preview, preview
            popup.select_option('#profile','careerops_json')
            assert '"schema_version": "1.0"' in popup.locator('#preview').inner_text()
            if capture_screenshot:
                popup.set_viewport_size({'width':800,'height':980})
                popup.screenshot(path=capture_screenshot, full_page=True)
            print(f'PASS Chromium extension MV3 service worker: {worker.url}')
            print('PASS page JSON-LD capture, form edit, full application rendering, JSON profile')
            popup.close()
        finally:
            ctx.close()
    server.shutdown()

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    parser.add_argument('--screenshot')
    args=parser.parse_args()
    run(args.chromium,args.screenshot)
