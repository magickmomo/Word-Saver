#!/usr/bin/env python3
"""Build a Chrome Web Store upload ZIP with a manifest at its root.

Run from anywhere with: python3 scripts/build_webstore_zip.py
No extra Python dependencies are needed.
"""

from __future__ import annotations

import json
import struct
import subprocess
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
FILES = [
    "manifest.json",
    "background.js",
    "content.js",
    "highlight.css",
    "mark.es6.js",
    "popup.html",
    "popup.css",
    "popup.js",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "THIRD_PARTY_NOTICES.md",
]


def validate_icon(relative_path: str, expected_size: int) -> None:
    content = (ROOT / relative_path).read_bytes()
    if len(content) < 24 or content[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{relative_path} is not a valid PNG")
    width, height = struct.unpack(">II", content[16:24])
    if (width, height) != (expected_size, expected_size):
        raise ValueError(
            f"{relative_path} is {width}x{height}; expected {expected_size}x{expected_size}"
        )


def main() -> None:
    missing = [name for name in FILES if not (ROOT / name).is_file()]
    if missing:
        raise FileNotFoundError(f"Missing release files: {', '.join(missing)}")

    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("manifest_version") != 3:
        raise ValueError("Expected a Manifest V3 extension")

    version = manifest.get("version")
    if not isinstance(version, str) or not version:
        raise ValueError("Manifest version is missing")

    for size in (16, 48, 128):
        relative = f"icons/icon{size}.png"
        if manifest.get("icons", {}).get(str(size)) != relative:
            raise ValueError(f"Manifest does not reference {relative}")
        validate_icon(relative, size)

    node = shutil.which("node")
    if node:
        for name in ("background.js", "content.js", "popup.js", "mark.es6.js"):
            subprocess.run([node, "--check", str(ROOT / name)], check=True)
        print("JavaScript syntax checks passed.")
    else:
        print("Node.js not found: skipped optional JavaScript syntax checks.")

    destination = ROOT / "dist"
    destination.mkdir(exist_ok=True)
    output = destination / f"little-dictionary-{version}.zip"

    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in FILES:
            archive.write(ROOT / path, arcname=path)

    with ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("Release ZIP failed its integrity check")
        if "manifest.json" not in archive.namelist():
            raise RuntimeError("Manifest is not at the ZIP root")

    print(f"Created {output}")


if __name__ == "__main__":
    main()
