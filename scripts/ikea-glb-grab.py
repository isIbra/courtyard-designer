"""
Download IKEA 3D furniture models (GLB) by intercepting network requests.
Uses Selenium CDP to catch GLB URLs loaded when clicking "View in 3D".

Usage: python scripts/ikea-glb-grab.py
"""

import os, sys, json, re, time, requests
from tqdm import tqdm
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
import logging

logging.getLogger('WDM').setLevel(logging.NOTSET)
os.environ['WDM_LOG_LEVEL'] = '0'

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'ikea')
os.makedirs(OUT_DIR, exist_ok=True)

# ── Product list: (catalog_id, filename, ikea_url) ──
# Expanded list targeting products likely to have 3D models
PRODUCTS = [
    # Living Room
    ('sofa_3seat',    'sofa_3seat.glb',     'https://www.ikea.com/us/en/p/kivik-sofa-tibbleby-beige-s89440564/'),
    ('sofa',          'sofa.glb',           'https://www.ikea.com/us/en/p/ektorp-sofa-tallmyra-white-black-s19322065/'),
    ('loveseat',      'loveseat.glb',       'https://www.ikea.com/us/en/p/landskrona-loveseat-grann-bomstad-golden-brown-metal-s99032408/'),
    ('armchair',      'armchair.glb',       'https://www.ikea.com/us/en/p/strandmon-wing-chair-nordvalla-dark-grey-90359822/'),
    ('sectional',     'sectional.glb',      'https://www.ikea.com/us/en/p/friheten-corner-sofa-bed-with-storage-skiftebo-dark-grey-s69216757/'),
    ('coffee_tbl',    'coffee_tbl.glb',     'https://www.ikea.com/us/en/p/lack-coffee-table-black-brown-40104294/'),
    ('side_table',    'side_table.glb',     'https://www.ikea.com/us/en/p/lack-side-table-black-brown-20011413/'),
    ('tv_stand',      'tv_stand.glb',       'https://www.ikea.com/us/en/p/besta-tv-unit-with-doors-white-lappviken-white-s49440494/'),
    ('bookshelf',     'bookshelf.glb',      'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-80275887/'),
    ('bookshelf_low', 'bookshelf_low.glb',  'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-20275814/'),
    ('cabinet',       'cabinet.glb',        'https://www.ikea.com/us/en/p/besta-storage-combination-with-doors-white-lappviken-white-s89440519/'),
    ('floor_lamp',    'floor_lamp.glb',     'https://www.ikea.com/us/en/p/hektogram-floor-lamp-dark-grey-30494169/'),
    ('table_lamp',    'table_lamp.glb',     'https://www.ikea.com/us/en/p/lampan-table-lamp-white-20046988/'),
    ('plant_pot',     'plant_pot.glb',      'https://www.ikea.com/us/en/p/fejka-artificial-potted-plant-indoor-outdoor-monstera-80395307/'),
    ('rug_rect',      'rug_rect.glb',       'https://www.ikea.com/us/en/p/stoense-rug-low-pile-medium-gray-60423813/'),

    # Bedroom
    ('bed_double',    'bed_double.glb',     'https://www.ikea.com/us/en/p/malm-bed-frame-high-white-stained-oak-veneer-luroey-s69175513/'),
    ('wardrobe',      'wardrobe.glb',       'https://www.ikea.com/us/en/p/pax-wardrobe-white-00256843/'),
    ('nightstand',    'nightstand.glb',     'https://www.ikea.com/us/en/p/malm-2-drawer-chest-white-stained-oak-veneer-80403570/'),
    ('dresser',       'dresser.glb',        'https://www.ikea.com/us/en/p/malm-6-drawer-dresser-white-stained-oak-veneer-80403567/'),

    # Kitchen / Dining
    ('dining_tbl',    'dining_tbl.glb',     'https://www.ikea.com/us/en/p/lisabo-table-ash-veneer-70280225/'),
    ('round_table',   'round_table.glb',    'https://www.ikea.com/us/en/p/docksta-table-white-white-s49932867/'),
    ('chair',         'chair.glb',          'https://www.ikea.com/us/en/p/stefan-chair-brown-black-002-110-88/'),
    ('fridge',        'fridge.glb',         'https://www.ikea.com/us/en/p/lagan-bottom-freezer-refrigerator-stainless-steel-color-80530318/'),
    ('counter',       'counter.glb',        'https://www.ikea.com/us/en/p/knoxhult-base-cabinet-with-doors-and-drawer-white-50326808/'),
    ('desk',          'desk.glb',           'https://www.ikea.com/us/en/p/malm-desk-white-002-141-81/'),
    ('office_chair',  'office_chair.glb',   'https://www.ikea.com/us/en/p/markus-office-chair-vissle-dark-grey-70261150/'),

    # Additional products with known 3D models
    ('poang_chair',   'poang_chair.glb',    'https://www.ikea.com/us/en/p/poaeng-armchair-birch-veneer-knisa-light-beige-s29306683/'),
    ('hemnes_shelf',  'hemnes_shelf.glb',   'https://www.ikea.com/us/en/p/hemnes-bookcase-white-stain-60263233/'),
    ('billy_book',    'billy_book.glb',     'https://www.ikea.com/us/en/p/billy-bookcase-white-00263850/'),
    ('alex_desk',     'alex_desk.glb',      'https://www.ikea.com/us/en/p/alex-desk-white-00473546/'),
    ('soderhamn',     'soderhamn.glb',      'https://www.ikea.com/us/en/p/soederhamn-sofa-section-3-seat-fridtuna-light-beige-s49440523/'),
    ('gronlid_sofa',  'gronlid_sofa.glb',   'https://www.ikea.com/us/en/p/gronlid-sofa-sporda-natural-s19164443/'),
    ('vimle_sofa',    'vimle_sofa.glb',     'https://www.ikea.com/us/en/p/vimle-sofa-gunnared-medium-gray-s39305061/'),
    ('lidhult_sofa',  'lidhult_sofa.glb',   'https://www.ikea.com/us/en/p/lidhult-sofa-gassebol-light-beige-s59257121/'),
    ('norraryd_chr',  'norraryd_chair.glb', 'https://www.ikea.com/us/en/p/norraryd-chair-black-80273675/'),
    ('ekedalen_tbl',  'ekedalen_tbl.glb',   'https://www.ikea.com/us/en/p/ekedalen-extendable-table-dark-brown-80340830/'),
    ('hemnes_bed',    'hemnes_bed.glb',     'https://www.ikea.com/us/en/p/hemnes-bed-frame-white-stain-luroey-s09017826/'),
    ('nordli_bed',    'nordli_bed.glb',     'https://www.ikea.com/us/en/p/nordli-bed-frame-with-storage-white-s79241365/'),
    ('brimnes_bed',   'brimnes_bed.glb',    'https://www.ikea.com/us/en/p/brimnes-bed-frame-with-storage-white-luroey-s69229294/'),
    ('hemnes_night',  'hemnes_night.glb',   'https://www.ikea.com/us/en/p/hemnes-nightstand-white-stain-40344074/'),
    ('tarva_night',   'tarva_nightstand.glb','https://www.ikea.com/us/en/p/tarva-nightstand-pine-90284180/'),
]


def get_driver():
    """Create Chrome driver with CDP network logging enabled."""
    options = webdriver.ChromeOptions()
    options.add_argument('--headless=new')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--log-level=3')
    options.add_experimental_option('excludeSwitches', ['enable-logging'])
    # Enable performance logging to capture network requests
    options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})

    original_stderr = sys.stderr
    sys.stderr = open(os.devnull, 'w')
    try:
        service = Service(ChromeDriverManager(log_level=0).install())
    except TypeError:
        service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    sys.stderr = original_stderr
    return driver


def find_glb_from_network(driver, url, timeout=15):
    """
    Navigate to IKEA product page, click 'View in 3D' if available,
    and capture GLB URLs from network requests via CDP.
    """
    glb_urls = []

    # Enable CDP Network domain to intercept requests
    driver.execute_cdp_cmd('Network.enable', {})

    driver.get(url)
    time.sleep(3)  # Wait for page JS to load

    # Method 1: Check for <model-viewer> element (some pages embed it directly)
    try:
        model_viewers = driver.find_elements(By.CSS_SELECTOR, 'model-viewer')
        for mv in model_viewers:
            src = mv.get_attribute('src')
            if src and '.glb' in src.lower():
                glb_urls.append(src)
    except:
        pass

    # Method 2: Look for the "View in 3D" / "View in Room" button and click it
    view3d_clicked = False
    for selector in [
        '[data-testid="pip-xr-button"]',
        'button[aria-label*="3D"]',
        'button[aria-label*="room"]',
        'button[aria-label*="View in"]',
        '#pip-xr-viewer-model',
        '.pip-media-grid__xr-button',
        '[class*="xr-button"]',
        '[class*="3d-button"]',
    ]:
        try:
            btn = driver.find_element(By.CSS_SELECTOR, selector)
            if btn and btn.is_displayed():
                btn.click()
                view3d_clicked = True
                time.sleep(4)  # Wait for model to load
                break
        except:
            pass

    # Method 3: Also try clicking via JavaScript on any element containing "3D" text
    if not view3d_clicked and not glb_urls:
        try:
            driver.execute_script("""
                const btns = document.querySelectorAll('button, a, [role="button"]');
                for (const b of btns) {
                    if (b.textContent.match(/3D|View in room/i)) {
                        b.click();
                        break;
                    }
                }
            """)
            time.sleep(4)
        except:
            pass

    # Method 4: Check model-viewer again after clicking
    try:
        model_viewers = driver.find_elements(By.CSS_SELECTOR, 'model-viewer')
        for mv in model_viewers:
            src = mv.get_attribute('src')
            if src and '.glb' in src.lower():
                glb_urls.append(src)
    except:
        pass

    # Method 5: Check performance logs for network requests containing .glb
    try:
        logs = driver.get_log('performance')
        for entry in logs:
            try:
                msg = json.loads(entry['message'])['message']
                if msg['method'] in ('Network.requestWillBeSent', 'Network.responseReceived'):
                    req_url = ''
                    if 'request' in msg.get('params', {}):
                        req_url = msg['params']['request'].get('url', '')
                    elif 'response' in msg.get('params', {}):
                        req_url = msg['params']['response'].get('url', '')
                    if req_url and ('.glb' in req_url.lower() or 'glb_draco' in req_url.lower()):
                        glb_urls.append(req_url)
            except:
                pass
    except:
        pass

    # Method 6: Search page source as fallback
    try:
        src = driver.page_source
        # dimma API pattern
        matches = re.findall(r'https://web-api\.ikea\.com/dimma/assets/[^"\'\s]+\.glb[^"\'\s]*', src)
        glb_urls.extend(matches)
        # Broader pattern
        matches2 = re.findall(r'https://[^"\'\s]*\.glb(?:\?[^"\'\s]*)?', src)
        glb_urls.extend(matches2)
    except:
        pass

    # Method 7: Check #pip-xr-viewer-model script tag
    try:
        script_el = driver.find_element(By.ID, 'pip-xr-viewer-model')
        data = json.loads(script_el.get_attribute('innerHTML'))
        if data.get('url'):
            glb_urls.append(data['url'])
    except:
        pass

    # Deduplicate and pick best quality
    seen = set()
    unique = []
    for u in glb_urls:
        # Clean up URL
        u = u.split('"')[0].split("'")[0].split(' ')[0]
        if u not in seen and '.glb' in u.lower():
            seen.add(u)
            unique.append(u)

    if not unique:
        return None

    # Prefer highest quality (iqp3 > iqp2 > iqp1), prefer draco compressed
    for quality in ['iqp3', 'iqp2', 'iqp1']:
        for u in unique:
            if quality in u:
                return u

    return unique[0]


def download_file(url, path):
    """Download with progress bar."""
    try:
        resp = requests.get(url, stream=True, timeout=30, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        resp.raise_for_status()
        total = int(resp.headers.get('content-length', 0))
        with open(path, 'wb') as f, tqdm(total=total, unit='B', unit_scale=True,
                                          desc=os.path.basename(path)) as bar:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
                bar.update(len(chunk))
        return True
    except Exception as e:
        print(f"  Download error: {e}")
        return False


def main():
    print(f"IKEA GLB Grabber — Network Interception Method")
    print(f"Target: {OUT_DIR}")
    print(f"Products: {len(PRODUCTS)}\n")

    driver = get_driver()
    downloaded, skipped, failed = 0, 0, 0
    manifest = {}

    try:
        for catalog_id, filename, url in PRODUCTS:
            filepath = os.path.join(OUT_DIR, filename)

            # Skip if already downloaded and valid size
            if os.path.exists(filepath) and os.path.getsize(filepath) > 5000:
                sz = os.path.getsize(filepath) // 1024
                print(f"[skip] {catalog_id} ({sz}KB)")
                manifest[catalog_id] = filename
                skipped += 1
                continue

            short = url.split('/')[-2][:50]
            print(f"[fetch] {catalog_id} — {short}")

            glb_url = find_glb_from_network(driver, url)

            if glb_url:
                print(f"  -> {glb_url[:120]}")
                if download_file(glb_url, filepath):
                    sz = os.path.getsize(filepath)
                    if sz > 1000:
                        manifest[catalog_id] = filename
                        downloaded += 1
                        print(f"  OK ({sz // 1024}KB)")
                    else:
                        os.remove(filepath)
                        print(f"  Too small ({sz}B), removed")
                        failed += 1
                else:
                    failed += 1
            else:
                print(f"  No 3D model found")
                failed += 1

    finally:
        driver.quit()

    # Write manifest
    manifest_path = os.path.join(OUT_DIR, 'manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Downloaded: {downloaded} | Skipped: {skipped} | No model: {failed}")
    print(f"Manifest: {manifest_path}")
    if manifest:
        print(f"\nAll models:")
        for cid, fname in sorted(manifest.items()):
            fpath = os.path.join(OUT_DIR, fname)
            sz = os.path.getsize(fpath) // 1024 if os.path.exists(fpath) else 0
            print(f"  {cid}: {fname} ({sz}KB)")


if __name__ == '__main__':
    main()
