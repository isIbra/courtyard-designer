"""Quick probe: check a few US IKEA product pages for 3D model data."""
import sys, json, time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException
import logging
logging.getLogger('WDM').setLevel(logging.NOTSET)

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

# US IKEA products likely to have 3D models
urls = [
    'https://www.ikea.com/us/en/p/kivik-sofa-tibbleby-beige-s89440564/',
    'https://www.ikea.com/us/en/p/strandmon-wing-chair-nordvalla-dark-grey-90359822/',
    'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-80275887/',
    'https://www.ikea.com/us/en/p/malm-bed-frame-high-white-stained-oak-veneer-luroey-s69175513/',
    'https://www.ikea.com/us/en/p/lack-side-table-black-brown-20011413/',
]

for url in urls:
    print(f"\n--- {url.split('/')[-2]} ---")
    driver.get(url)
    time.sleep(3)

    # Look for various 3D model indicators
    for selector in ['#pip-xr-viewer-model', '[data-testid*="3d"]', '[data-testid*="xr"]', 'script[type="application/ld+json"]']:
        try:
            els = driver.find_elements(By.CSS_SELECTOR, selector)
            if els:
                print(f"  Found {selector}: {len(els)} elements")
                for el in els[:2]:
                    txt = el.get_attribute('innerHTML')[:200]
                    print(f"    Content: {txt}")
        except:
            pass

    # Check for GLB/GLTF URLs in page source
    src = driver.page_source
    glb_matches = [m for m in src.split('"') if '.glb' in m.lower() or 'gltf' in m.lower()]
    if glb_matches:
        print(f"  Found GLB/GLTF URLs:")
        for m in glb_matches[:5]:
            print(f"    {m[:150]}")
    else:
        print(f"  No GLB/GLTF URLs found in page source")

driver.quit()
print("\nDone.")
