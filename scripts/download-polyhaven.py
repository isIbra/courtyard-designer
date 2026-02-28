#!/usr/bin/env python3
"""
Download Poly Haven furniture models as GLTF (1k textures),
then convert each to a single .glb via gltf-pipeline.

Usage:
  python scripts/download-polyhaven.py

Output:
  public/models/polyhaven/<id>.glb          — final GLB files
  public/models/polyhaven/manifest.json     — catalog mapping
  _tmp_polyhaven/                           — intermediate GLTF (cleaned up on success)
"""

import json, os, sys, subprocess, shutil, time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError

API = "https://api.polyhaven.com"
DL  = "https://dl.polyhaven.org/file/ph-assets/Models"
RES = "1k"  # texture resolution

ROOT     = Path(__file__).resolve().parent.parent
OUT_DIR  = ROOT / "public" / "models" / "polyhaven"
TMP_DIR  = ROOT / "_tmp_polyhaven"

# Furniture category dimensions (approx meters, for catalog entries)
# We'll measure from the GLTF bounding box after conversion
CATEGORY_MAP = {
    "seating": "living",
    "furniture": "living",
    "storage": "living",
    "table": "living",
    "outdoor": "outdoor",
}


def fetch_json(url):
    """Fetch JSON from a URL with retry."""
    for attempt in range(3):
        try:
            req = Request(url, headers={"User-Agent": "CourtyardDesigner/1.0"})
            with urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except Exception as e:
            if attempt == 2:
                raise
            print(f"  Retry {attempt+1} for {url}: {e}")
            time.sleep(2)


def download_file(url, dest):
    """Download a file with retry."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return  # skip if already downloaded
    for attempt in range(3):
        try:
            req = Request(url, headers={"User-Agent": "CourtyardDesigner/1.0"})
            with urlopen(req, timeout=60) as resp:
                with open(dest, "wb") as f:
                    while True:
                        chunk = resp.read(65536)
                        if not chunk:
                            break
                        f.write(chunk)
            return
        except Exception as e:
            if dest.exists():
                dest.unlink()
            if attempt == 2:
                raise
            print(f"  Retry {attempt+1}: {e}")
            time.sleep(2)


def get_furniture_models():
    """Get list of all furniture model IDs from Poly Haven API."""
    print("Fetching furniture model list...")
    data = fetch_json(f"{API}/assets?t=models&c=furniture")
    models = []
    for model_id, info in sorted(data.items()):
        models.append({
            "id": model_id,
            "name": info.get("name", model_id),
            "categories": info.get("categories", []),
        })
    print(f"Found {len(models)} furniture models")
    return models


def download_gltf(model_id):
    """Download all GLTF files for a model at the specified resolution."""
    model_dir = TMP_DIR / model_id

    # Check if already converted
    glb_path = OUT_DIR / f"{model_id}.glb"
    if glb_path.exists():
        return True  # already done

    # Get file listing from API
    files_data = fetch_json(f"{API}/files/{model_id}")

    # Navigate to gltf format
    gltf_data = files_data.get("gltf", {})
    res_data = gltf_data.get(RES, {})

    if not res_data:
        # Try other resolutions
        for fallback_res in ["2k", "4k", "1k"]:
            res_data = gltf_data.get(fallback_res, {})
            if res_data:
                break

    if not res_data:
        print(f"  WARNING: No GLTF data found for {model_id}")
        return False

    # The API nests: res_data["gltf"] = { url, size, include: { relative_path: {url, size} } }
    gltf_entry = res_data.get("gltf", {})
    main_url = gltf_entry.get("url")
    if not main_url:
        print(f"  WARNING: No GLTF URL found for {model_id}")
        return False

    # Determine the filename from the URL
    main_filename = main_url.rsplit("/", 1)[-1]
    main_path = model_dir / main_filename
    print(f"    {main_filename} ({gltf_entry.get('size', '?')} bytes)")
    download_file(main_url, main_path)

    # Download included files (bin, textures)
    include = gltf_entry.get("include", {})
    for rel_path, file_info in include.items():
        url = file_info.get("url")
        if not url:
            continue
        local_path = model_dir / rel_path
        print(f"    {rel_path} ({file_info.get('size', '?')} bytes)")
        download_file(url, local_path)

    return True


def convert_to_glb(model_id):
    """Convert downloaded GLTF to GLB using gltf-pipeline."""
    model_dir = TMP_DIR / model_id
    glb_path = OUT_DIR / f"{model_id}.glb"

    if glb_path.exists():
        return True

    # Find the .gltf file
    gltf_files = list(model_dir.glob("*.gltf"))
    if not gltf_files:
        print(f"  WARNING: No .gltf file found in {model_dir}")
        return False

    gltf_file = gltf_files[0]

    # Convert using gltf-pipeline (shell=True needed on Windows for npx)
    try:
        cmd = f'npx gltf-pipeline -i "{gltf_file}" -o "{glb_path}" -b'
        result = subprocess.run(
            cmd, shell=True,
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            print(f"  ERROR converting {model_id}: {result.stderr[:200]}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT converting {model_id}")
        return False
    except Exception as e:
        print(f"  ERROR converting {model_id}: {e}")
        return False


def build_manifest(models, successful_ids):
    """Build manifest.json mapping model IDs to filenames."""
    manifest = {}
    for m in models:
        if m["id"] in successful_ids:
            manifest[m["id"]] = {
                "file": f"{m['id']}.glb",
                "name": m["name"],
                "categories": m["categories"],
            }

    manifest_path = OUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest written: {manifest_path} ({len(manifest)} models)")
    return manifest


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    models = get_furniture_models()

    successful = set()
    failed = []

    for i, model in enumerate(models):
        model_id = model["id"]
        print(f"\n[{i+1}/{len(models)}] {model['name']} ({model_id})")

        # Check if already converted
        glb_path = OUT_DIR / f"{model_id}.glb"
        if glb_path.exists():
            print(f"  Already exists, skipping")
            successful.add(model_id)
            continue

        # Download GLTF
        print(f"  Downloading GLTF ({RES})...")
        try:
            ok = download_gltf(model_id)
            if not ok:
                failed.append(model_id)
                continue
        except Exception as e:
            print(f"  DOWNLOAD FAILED: {e}")
            failed.append(model_id)
            continue

        # Convert to GLB
        print(f"  Converting to GLB...")
        ok = convert_to_glb(model_id)
        if ok:
            successful.add(model_id)
            # Clean up temp files for this model
            model_tmp = TMP_DIR / model_id
            if model_tmp.exists():
                shutil.rmtree(model_tmp)
        else:
            failed.append(model_id)

    # Build manifest
    manifest = build_manifest(models, successful)

    # Summary
    print(f"\n{'='*50}")
    print(f"Downloaded & converted: {len(successful)}/{len(models)}")
    if failed:
        print(f"Failed: {', '.join(failed)}")

    # Clean up tmp dir if empty
    if TMP_DIR.exists() and not any(TMP_DIR.iterdir()):
        TMP_DIR.rmdir()

    print(f"\nGLB files in: {OUT_DIR}")
    print("Next: Add entries to CATALOG in app/modules/furniture.js")


if __name__ == "__main__":
    main()
