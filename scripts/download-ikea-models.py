"""
Download specific IKEA furniture GLB models for the courtyard designer.
Uses Selenium headless to extract GLB URLs from product pages.

Usage: python scripts/download-ikea-models.py
"""

import os
import sys
import json
import re
import requests
from tqdm import tqdm
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException
import logging

logging.getLogger('WDM').setLevel(logging.NOTSET)
os.environ['WDM_LOG_LEVEL'] = '0'

# Target directory
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'ikea')
os.makedirs(OUT_DIR, exist_ok=True)

# Products to download — mapped to our catalog IDs
# Format: (catalog_id, ikea_url)
# Using IKEA Saudi Arabia (sa/en) for relevance, fallback to US
PRODUCTS = [
    # ── Living Room ──
    ('sofa_3seat',    'https://www.ikea.com/sa/en/p/kivik-3-seat-sofa-tresund-light-beige-s69481595/'),
    ('sofa',          'https://www.ikea.com/sa/en/p/kivik-2-seat-sofa-tresund-light-beige-s69481592/'),
    ('loveseat',      'https://www.ikea.com/sa/en/p/landskrona-2-seat-sofa-gunnared-light-green-wood-s59270317/'),
    ('armchair',      'https://www.ikea.com/sa/en/p/strandmon-wing-chair-nordvalla-dark-grey-90359822/'),
    ('coffee_tbl',    'https://www.ikea.com/sa/en/p/lack-coffee-table-black-brown-40104294/'),
    ('side_table',    'https://www.ikea.com/sa/en/p/lack-side-table-black-brown-20011413/'),
    ('tv_stand',      'https://www.ikea.com/sa/en/p/besta-tv-unit-black-brown-20299885/'),
    ('bookshelf',     'https://www.ikea.com/sa/en/p/kallax-shelving-unit-white-80275887/'),
    ('floor_lamp',    'https://www.ikea.com/sa/en/p/hektogram-floor-lamp-dark-grey-30494169/'),
    ('plant_pot',     'https://www.ikea.com/sa/en/p/fejka-artificial-potted-plant-in-outdoor-monstera-80395307/'),

    # ── Bedroom ──
    ('bed_double',    'https://www.ikea.com/sa/en/p/malm-bed-frame-high-white-stained-oak-veneer-luroey-s69175513/'),
    ('wardrobe',      'https://www.ikea.com/sa/en/p/pax-wardrobe-white-10429580/'),
    ('nightstand',    'https://www.ikea.com/sa/en/p/malm-chest-of-2-drawers-white-stained-oak-veneer-00403570/'),
    ('dresser',       'https://www.ikea.com/sa/en/p/malm-chest-of-6-drawers-white-stained-oak-veneer-80403567/'),

    # ── Kitchen / Dining ──
    ('dining_tbl',    'https://www.ikea.com/sa/en/p/lisabo-table-ash-veneer-70280225/'),
    ('round_table',   'https://www.ikea.com/sa/en/p/docksta-table-white-white-s49932867/'),
    ('chair',         'https://www.ikea.com/sa/en/p/teodores-chair-white-90349847/'),
    ('fridge',        'https://www.ikea.com/sa/en/p/lagan-fridge-freezer-a-freestanding-white-60530338/'),

    # ── Bathroom ──
    ('toilet',        'https://www.ikea.com/sa/en/p/godmorgon-bathroom-vanity-kasjoen-white-s19439134/'),
    ('sink',          'https://www.ikea.com/sa/en/p/godmorgon-tolken-tornviken-bathroom-vanity-w-countertop-45-wash-basin-kasjoen-white-marble-effect-s59392715/'),

    # ── Office ──
    ('desk',          'https://www.ikea.com/sa/en/p/malm-desk-white-stained-oak-veneer-50359823/'),
    ('office_chair',  'https://www.ikea.com/sa/en/p/markus-office-chair-vissle-dark-grey-70261150/'),

    # ── Outdoor ──
    ('bench',         'https://www.ikea.com/sa/en/p/naemmaroe-bench-outdoor-light-brown-stained-00510041/'),
]


def get_driver():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--log-level=3')
    options.add_experimental_option('excludeSwitches', ['enable-logging'])

    original_stderr = sys.stderr
    sys.stderr = open(os.devnull, 'w')
    try:
        service = Service(ChromeDriverManager(log_level=0).install())
    except TypeError:
        service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    sys.stderr = original_stderr
    return driver


def extract_glb_url(driver, url):
    """Extract GLB model URL from an IKEA product page."""
    driver.get(url)
    try:
        script_el = WebDriverWait(driver, 8).until(
            EC.presence_of_element_located((By.ID, 'pip-xr-viewer-model'))
        )
        data = json.loads(script_el.get_attribute('innerHTML'))
        return data.get('url')
    except TimeoutException:
        print(f"  No 3D model found")
        return None
    except json.JSONDecodeError:
        print(f"  JSON decode error")
        return None


def download_file(url, path):
    """Download a file with progress bar."""
    resp = requests.get(url, stream=True)
    total = int(resp.headers.get('content-length', 0))
    with open(path, 'wb') as f, tqdm(total=total, unit='B', unit_scale=True, desc=os.path.basename(path)) as bar:
        for chunk in resp.iter_content(1024):
            f.write(chunk)
            bar.update(len(chunk))


def main():
    print(f"Downloading IKEA models to {OUT_DIR}")
    print(f"Products to fetch: {len(PRODUCTS)}\n")

    driver = get_driver()
    downloaded = 0
    skipped = 0
    failed = 0

    manifest = {}

    try:
        for catalog_id, url in PRODUCTS:
            filename = f"{catalog_id}.glb"
            filepath = os.path.join(OUT_DIR, filename)

            if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
                print(f"[skip] {catalog_id} — already exists ({os.path.getsize(filepath)} bytes)")
                manifest[catalog_id] = filename
                skipped += 1
                continue

            print(f"[fetch] {catalog_id} — {url}")
            glb_url = extract_glb_url(driver, url)

            if glb_url:
                print(f"  GLB: {glb_url[:80]}...")
                download_file(glb_url, filepath)
                manifest[catalog_id] = filename
                downloaded += 1
            else:
                failed += 1
    finally:
        driver.quit()

    # Write manifest
    manifest_path = os.path.join(OUT_DIR, 'manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\n{'='*50}")
    print(f"Done! Downloaded: {downloaded}, Skipped: {skipped}, Failed: {failed}")
    print(f"Manifest: {manifest_path}")


if __name__ == '__main__':
    main()
