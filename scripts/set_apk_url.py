"""把 release.json 指向新版本的可达 APK，并同步根目录/代码目录两份副本。

用法: python scripts/set_apk_url.py <apkUrl> [version] [buildNo]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [ROOT / "release.json", ROOT / "05_代码" / "release.json"]


def main() -> None:
    url = sys.argv[1]
    version = sys.argv[2] if len(sys.argv) > 2 else None
    build_no = int(sys.argv[3]) if len(sys.argv) > 3 else None
    for path in TARGETS:
        data = json.loads(path.read_text(encoding="utf-8"))
        data["apkUrl"] = url
        if version:
            data["version"] = version
        if build_no is not None:
            data["buildNo"] = build_no
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"{path}: {data['version']}/{data['buildNo']} -> {url}")


if __name__ == "__main__":
    main()
