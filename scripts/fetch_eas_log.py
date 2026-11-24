"""Fetch an EAS build log URL (Brotli/gzip) and save plain text.

Usage: python fetch_eas_log.py <signed-url> <out-file>
"""
import sys
import urllib.request
import gzip
import brotli

url, out = sys.argv[1], sys.argv[2]
req = urllib.request.Request(url, headers={"User-Agent": "curl/8", "Accept-Encoding": "identity"})
raw = urllib.request.urlopen(req, timeout=60).read()
try:
    text = brotli.decompress(raw).decode("utf-8", "replace")
except Exception:
    if raw[:2] == b"\x1f\x8b":
        text = gzip.decompress(raw).decode("utf-8", "replace")
    else:
        text = raw.decode("utf-8", "replace")
with open(out, "w", encoding="utf-8") as f:
    f.write(text)
print(f"bytes={len(raw)} text={len(text)}")
