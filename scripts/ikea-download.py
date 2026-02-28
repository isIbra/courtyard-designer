"""
Download IKEA 3D furniture models (GLB) from US IKEA site.
Finds GLB URLs in page source via the dimma API pattern.
"""
import os, sys, json, re, time, requests
from tqdm import tqdm
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import logging
logging.getLogger('WDM').setLevel(logging.NOTSET)

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'ikea')
os.makedirs(OUT_DIR, exist_ok=True)

# Products — curated list of IKEA US items likely to have 3D models
# (catalog_id, filename, url)
PRODUCTS = [
    # Storage / Shelving (known to have 3D)
    ('bookshelf',     'kallax_shelf.glb',     'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-80275887/'),
    ('bookshelf_low', 'kallax_shelf_2x2.glb', 'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-20275814/'),
    ('cabinet',       'besta_cabinet.glb',    'https://www.ikea.com/us/en/p/besta-storage-combination-with-doors-white-lappviken-white-s89440519/'),
    ('tv_stand',      'besta_tv.glb',         'https://www.ikea.com/us/en/p/besta-tv-unit-with-doors-white-lappviken-white-s49440494/'),

    # Sofas
    ('sofa_3seat',    'kivik_3seat.glb',      'https://www.ikea.com/us/en/p/kivik-sofa-tibbleby-beige-s89440564/'),
    ('sofa',          'ektorp_sofa.glb',       'https://www.ikea.com/us/en/p/ektorp-sofa-tallmyra-white-black-s19322065/'),
    ('loveseat',      'landskrona_love.glb',  'https://www.ikea.com/us/en/p/landskrona-loveseat-grann-bomstad-golden-brown-metal-s99032408/'),
    ('armchair',      'strandmon_chair.glb',  'https://www.ikea.com/us/en/p/strandmon-wing-chair-nordvalla-dark-grey-90359822/'),
    ('sectional',     'friheten_corner.glb',  'https://www.ikea.com/us/en/p/friheten-corner-sofa-bed-with-storage-skiftebo-dark-grey-s69216757/'),

    # Tables
    ('coffee_tbl',    'lack_coffee.glb',      'https://www.ikea.com/us/en/p/lack-coffee-table-black-brown-40104294/'),
    ('side_table',    'lack_side.glb',        'https://www.ikea.com/us/en/p/lack-side-table-black-brown-20011413/'),
    ('dining_tbl',    'lisabo_table.glb',     'https://www.ikea.com/us/en/p/lisabo-table-ash-veneer-70280225/'),
    ('round_table',   'docksta_table.glb',    'https://www.ikea.com/us/en/p/docksta-table-white-white-s49932867/'),
    ('console_table', 'hemnes_console.glb',   'https://www.ikea.com/us/en/p/hemnes-console-table-white-stain-80261459/'),
    ('desk',          'malm_desk.glb',        'https://www.ikea.com/us/en/p/malm-desk-white-002-141-81/'),

    # Chairs
    ('chair',         'stefan_chair.glb',     'https://www.ikea.com/us/en/p/stefan-chair-brown-black-002-110-88/'),
    ('office_chair',  'markus_chair.glb',     'https://www.ikea.com/us/en/p/markus-office-chair-vissle-dark-grey-70261150/'),
    ('design_chair',  'odger_chair.glb',      'https://www.ikea.com/us/en/p/odger-chair-white-beige-50382300/'),

    # Bedroom
    ('bed_double',    'malm_bed.glb',         'https://www.ikea.com/us/en/p/malm-bed-frame-high-white-stained-oak-veneer-luroey-s69175513/'),
    ('wardrobe',      'pax_wardrobe.glb',     'https://www.ikea.com/us/en/p/pax-wardrobe-white-00256843/'),
    ('nightstand',    'malm_2drawer.glb',     'https://www.ikea.com/us/en/p/malm-2-drawer-chest-white-stained-oak-veneer-80403570/'),
    ('dresser',       'malm_6drawer.glb',     'https://www.ikea.com/us/en/p/malm-6-drawer-dresser-white-stained-oak-veneer-80403567/'),

    # Lamps
    ('floor_lamp',    'hektogram_lamp.glb',   'https://www.ikea.com/us/en/p/hektogram-floor-lamp-dark-grey-30494169/'),
    ('table_lamp',    'lampan_lamp.glb',      'https://www.ikea.com/us/en/p/lampan-table-lamp-white-20046988/'),

    # Kitchen
    ('fridge',        'lagan_fridge.glb',     'https://www.ikea.com/us/en/p/lagan-bottom-freezer-refrigerator-stainless-steel-color-80530318/'),
    ('counter',       'knoxhult_base.glb',    'https://www.ikea.com/us/en/p/knoxhult-base-cabinet-with-doors-and-drawer-white-50326808/'),

    # Misc
    ('plant_pot',     'fejka_plant.glb',      'https://www.ikea.com/us/en/p/fejka-artificial-potted-plant-indoor-outdoor-monstera-80395307/'),
    ('rug_rect',      'stoense_rug.glb',      'https://www.ikea.com/us/en/p/stoense-rug-low-pile-medium-gray-60423813/'),
]


def get_driver():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--log-level=3')
    options.add_experimental_option('excludeSwitches', ['enable-logging'])
    sys.stderr = open('NUL', 'w')
    try:
        service = Service(ChromeDriverManager(log_level=0).install())
    except TypeError:
        service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    sys.stderr = sys.__stderr__
    return driver


def find_glb_urls(driver, url):
    """Find GLB URLs in page source using the dimma API pattern."""
    driver.get(url)
    time.sleep(2)  # Let JS render
    src = driver.page_source
    # Pattern: web-api.ikea.com/dimma/assets/...glb_draco/...
    matches = re.findall(r'https://web-api\.ikea\.com/dimma/assets/[^"\']+\.g[lb]{2,3}', src)
    if not matches:
        # Also try broader pattern
        matches = re.findall(r'https://[^"\']*\.glb[^"\']*', src)
    # Prefer highest quality (iqp3 > iqp2 > iqp1)
    if matches:
        for quality in ['iqp3', 'iqp2', 'iqp1']:
            for m in matches:
                if quality in m:
                    return m
        return matches[0]
    return None


def download_file(url, path):
    resp = requests.get(url, stream=True, timeout=30)
    total = int(resp.headers.get('content-length', 0))
    with open(path, 'wb') as f, tqdm(total=total, unit='B', unit_scale=True, desc=os.path.basename(path)) as bar:
        for chunk in resp.iter_content(8192):
            f.write(chunk)
            bar.update(len(chunk))


def main():
    print(f"Target: {OUT_DIR}")
    print(f"Products: {len(PRODUCTS)}\n")

    driver = get_driver()
    downloaded, skipped, failed = 0, 0, 0
    manifest = {}

    try:
        for catalog_id, filename, url in PRODUCTS:
            filepath = os.path.join(OUT_DIR, filename)

            if os.path.exists(filepath) and os.path.getsize(filepath) > 5000:
                print(f"[skip] {catalog_id} ({os.path.getsize(filepath)//1024}KB)")
                manifest[catalog_id] = filename
                skipped += 1
                continue

            short = url.split('/')[-2][:40]
            print(f"[fetch] {catalog_id} ({short})")
            glb_url = find_glb_urls(driver, url)

            if glb_url:
                # Fix truncated URLs (page source sometimes cuts them)
                if not glb_url.endswith('.glb'):
                    glb_url += 'lb'  # fix truncated .g -> .glb
                print(f"  -> {glb_url[:100]}...")
                try:
                    download_file(glb_url, filepath)
                    if os.path.getsize(filepath) > 1000:
                        manifest[catalog_id] = filename
                        downloaded += 1
                    else:
                        os.remove(filepath)
                        print(f"  File too small, removed")
                        failed += 1
                except Exception as e:
                    print(f"  Download error: {e}")
                    failed += 1
            else:
                print(f"  No 3D model found")
                failed += 1
    finally:
        driver.quit()

    manifest_path = os.path.join(OUT_DIR, 'manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\n{'='*50}")
    print(f"Downloaded: {downloaded} | Skipped: {skipped} | No model: {failed}")
    print(f"Manifest: {manifest_path}")
    if manifest:
        print(f"\nSuccessful models:")
        for cid, fname in manifest.items():
            sz = os.path.getsize(os.path.join(OUT_DIR, fname)) // 1024
            print(f"  {cid}: {fname} ({sz}KB)")


if __name__ == '__main__':
    main()
