"""
Bulk scan IKEA US product pages to find which ones have 3D models.
Checks page source for dimma/GLB URLs - much faster than clicking 3D buttons.
Then downloads all found models.

Usage: python scripts/ikea-bulk-scan.py
"""

import os, sys, json, re, time, requests
from tqdm import tqdm
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from webdriver_manager.chrome import ChromeDriverManager
import logging

logging.getLogger('WDM').setLevel(logging.NOTSET)
os.environ['WDM_LOG_LEVEL'] = '0'

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'ikea')
os.makedirs(OUT_DIR, exist_ok=True)

# Category URLs to scan for products
CATEGORY_URLS = [
    'https://www.ikea.com/us/en/cat/sofas-fu003/',
    'https://www.ikea.com/us/en/cat/armchairs-fu006/',
    'https://www.ikea.com/us/en/cat/coffee-side-tables-10705/',
    'https://www.ikea.com/us/en/cat/tv-media-furniture-10475/',
    'https://www.ikea.com/us/en/cat/bookcases-shelving-units-st002/',
    'https://www.ikea.com/us/en/cat/beds-bm003/',
    'https://www.ikea.com/us/en/cat/wardrobes-19053/',
    'https://www.ikea.com/us/en/cat/chests-of-drawers-20656/',
    'https://www.ikea.com/us/en/cat/desks-computer-desks-20649/',
    'https://www.ikea.com/us/en/cat/dining-tables-21825/',
    'https://www.ikea.com/us/en/cat/dining-chairs-25219/',
    'https://www.ikea.com/us/en/cat/office-chairs-20652/',
    'https://www.ikea.com/us/en/cat/floor-lamps-10731/',
    'https://www.ikea.com/us/en/cat/table-lamps-desk-lamps-10732/',
    'https://www.ikea.com/us/en/cat/rugs-10653/',
    'https://www.ikea.com/us/en/cat/kitchen-islands-carts-24264/',
    'https://www.ikea.com/us/en/cat/nightstands-20656/',
    'https://www.ikea.com/us/en/cat/bathroom-vanities-20724/',
]

# Mapping: extract a catalog_id from product name
CATEGORY_MAP = {
    'sofa': 'living', 'armchair': 'living', 'coffee': 'living', 'side-table': 'living',
    'tv': 'living', 'bookcase': 'living', 'shelf': 'living', 'bed': 'bedroom',
    'wardrobe': 'bedroom', 'drawer': 'bedroom', 'nightstand': 'bedroom',
    'desk': 'office', 'dining': 'kitchen', 'chair': 'kitchen', 'office-chair': 'office',
    'lamp': 'living', 'rug': 'living', 'kitchen': 'kitchen', 'vanit': 'bathroom',
}


def get_driver():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless=new')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--log-level=3')
    options.add_experimental_option('excludeSwitches', ['enable-logging'])
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


def get_product_links(driver, category_url, max_products=30):
    """Get product links from an IKEA category page."""
    try:
        driver.get(category_url)
        time.sleep(3)

        # Scroll down to load more products
        for _ in range(3):
            driver.execute_script("window.scrollBy(0, 2000)")
            time.sleep(1)

        links = set()
        for el in driver.find_elements(By.CSS_SELECTOR, 'a[href*="/p/"]'):
            href = el.get_attribute('href')
            if href and '/p/' in href and href.endswith('/'):
                links.add(href)

        return list(links)[:max_products]
    except Exception as e:
        print(f"  Error loading category: {e}")
        return []


def check_for_3d_model(driver, product_url):
    """Quick check if a product page has a 3D model. Returns GLB URL or None."""
    try:
        driver.get(product_url)
        time.sleep(2)

        # Check page source for dimma/GLB URLs
        src = driver.page_source

        # Method 1: dimma API pattern
        matches = re.findall(
            r'https://web-api\.ikea\.com/dimma/assets/[^"\'\s<>]+\.glb[^"\'\s<>]*',
            src
        )

        # Method 2: Any GLB URL
        if not matches:
            matches = re.findall(r'https://[^"\'\s<>]*\.glb(?:\?[^"\'\s<>]*)?', src)

        # Method 3: Check #pip-xr-viewer-model
        if not matches:
            try:
                script_el = driver.find_element(By.ID, 'pip-xr-viewer-model')
                data = json.loads(script_el.get_attribute('innerHTML'))
                if data.get('url'):
                    matches = [data['url']]
            except:
                pass

        # Method 4: model-viewer element
        if not matches:
            try:
                mvs = driver.find_elements(By.CSS_SELECTOR, 'model-viewer')
                for mv in mvs:
                    s = mv.get_attribute('src')
                    if s and '.glb' in s.lower():
                        matches.append(s)
            except:
                pass

        if matches:
            # Clean and deduplicate
            clean = []
            for m in matches:
                m = m.split('"')[0].split("'")[0].split('<')[0].split(' ')[0]
                if '.glb' in m.lower() and m not in clean:
                    clean.append(m)

            # Prefer highest quality
            for q in ['iqp3', 'rqp3', 'iqp2', 'rqp2', 'iqp1']:
                for u in clean:
                    if q in u:
                        return u
            return clean[0] if clean else None

    except Exception as e:
        pass

    return None


def extract_product_name(url):
    """Extract a clean product name from IKEA URL."""
    # e.g. https://www.ikea.com/us/en/p/kallax-shelf-unit-white-80275887/
    parts = url.rstrip('/').split('/')
    slug = parts[-1] if parts else 'unknown'
    # Remove article number at the end
    slug = re.sub(r'-[a-z]?\d{7,}$', '', slug)
    return slug


def make_catalog_id(product_name):
    """Create a filesystem-safe catalog ID."""
    # Convert slug to underscore format
    cid = product_name.replace('-', '_')
    # Limit length
    return cid[:40]


def download_file(url, path):
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
        print(f"    Download error: {e}")
        return False


def main():
    print("IKEA Bulk 3D Model Scanner")
    print(f"Categories to scan: {len(CATEGORY_URLS)}")
    print(f"Output: {OUT_DIR}\n")

    driver = get_driver()

    # Load existing manifest
    manifest_path = os.path.join(OUT_DIR, 'manifest.json')
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            manifest = json.load(f)

    found_3d = []  # (product_name, url, glb_url)
    all_checked = 0
    downloaded = 0
    skipped = 0

    try:
        for cat_url in CATEGORY_URLS:
            cat_name = cat_url.rstrip('/').split('/')[-1]
            print(f"\n{'='*50}")
            print(f"Category: {cat_name}")

            product_links = get_product_links(driver, cat_url, max_products=20)
            print(f"  Found {len(product_links)} product links")

            for purl in product_links:
                pname = extract_product_name(purl)
                catalog_id = make_catalog_id(pname)
                filename = f"{catalog_id}.glb"
                filepath = os.path.join(OUT_DIR, filename)

                # Skip if already downloaded
                if os.path.exists(filepath) and os.path.getsize(filepath) > 5000:
                    sz = os.path.getsize(filepath) // 1024
                    print(f"  [skip] {pname} ({sz}KB)")
                    manifest[catalog_id] = filename
                    skipped += 1
                    all_checked += 1
                    continue

                all_checked += 1
                sys.stdout.write(f"  [{all_checked}] {pname[:40]}...")
                sys.stdout.flush()

                glb_url = check_for_3d_model(driver, purl)

                if glb_url:
                    print(f" 3D FOUND!")
                    print(f"    GLB: {glb_url[:100]}")

                    if download_file(glb_url, filepath):
                        sz = os.path.getsize(filepath)
                        if sz > 1000:
                            manifest[catalog_id] = filename
                            found_3d.append((pname, purl, glb_url))
                            downloaded += 1
                            print(f"    Saved: {filename} ({sz // 1024}KB)")
                        else:
                            os.remove(filepath)
                            print(f"    Too small, removed")
                    else:
                        print(f"    Download failed")
                else:
                    print(f" no 3D")

    finally:
        driver.quit()

    # Save manifest
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"Products checked: {all_checked}")
    print(f"3D models found & downloaded: {downloaded}")
    print(f"Previously downloaded: {skipped}")
    print(f"Total in manifest: {len(manifest)}")
    print(f"\nAll models:")
    for cid, fname in sorted(manifest.items()):
        fpath = os.path.join(OUT_DIR, fname)
        sz = os.path.getsize(fpath) // 1024 if os.path.exists(fpath) else 0
        print(f"  {cid}: {fname} ({sz}KB)")


if __name__ == '__main__':
    main()
