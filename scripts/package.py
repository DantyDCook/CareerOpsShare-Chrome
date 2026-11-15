"""Build reproducible extension-only and source archives, with checksums."""
from hashlib import sha256
from pathlib import Path
from argparse import ArgumentParser
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent
VERSION = json.loads((ROOT / 'manifest.json').read_text())['version']
RUNTIME_FILES = [
    'manifest.json', 'background.js', 'capture.js', 'core.js',
    'popup.html', 'review.html', 'ui.js', 'ui.css',
    'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png',
]
SOURCE_FILES = RUNTIME_FILES + [
    'README.md', 'package.json', 'docs/ROADMAP.md', 'docs/LOCALCI.md',
    'tests/core.test.js', 'tests/package.test.js', 'tests/browser_smoke.py',
    'tests/fixture/job.html', 'scripts/package.py', '.gitignore',
    '.github/workflows/localci.yml', '.engineering-governance.yaml',
]

def archive(name, paths, output_dir):
    target=output_dir/name
    with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as bundle:
        for relative in sorted(paths):
            full=ROOT/relative
            if not full.is_file():
                raise FileNotFoundError(full)
            zi=ZipInfo(relative, date_time=(2026, 11, 14, 0, 0, 0))
            zi.compress_type = ZIP_DEFLATED
            zi.external_attr=0o644 << 16
            bundle.writestr(zi, full.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
    return target

if __name__=='__main__':
    parser=ArgumentParser()
    parser.add_argument('--out-dir', type=Path, default=OUT, help='Archive output directory (defaults to checkout parent)')
    args=parser.parse_args()
    output_dir=args.out_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    artifacts=[
        archive(f'CareerOpsShare-Chrome-v{VERSION}-unpacked.zip', RUNTIME_FILES, output_dir),
        archive(f'CareerOpsShare-Chrome-v{VERSION}-source.zip', SOURCE_FILES, output_dir),
    ]
    manifest=output_dir/'CareerOpsShare-Chrome-SHA256SUMS.txt'
    manifest.write_text(''.join(f'{sha256(path.read_bytes()).hexdigest()}  {path.name}\n' for path in artifacts))
    for file in [*artifacts, manifest]:
        print(f'{file.name}: {file.stat().st_size:,} bytes')
