"""检查 APK 里被打包进 bundle 的 API 地址线索。"""
import zipfile
from pathlib import Path

APK = Path(
    r"D:\lg\project\工作流测试\projects\rn-mobile-app-release\10_交付\apk\rn-workout-1.0.0.apk"
)

with zipfile.ZipFile(APK) as z:
    bundle = z.read("assets/index.android.bundle")

needles = [
    b"10.0.2.2:8094",
    b"192.168.0.108:8094",
    b"127.0.0.1:8094",
    b"localhost:8094",
    b"http://10.0.2.2",
    b"http://192.168.0.108",
]
print("bundle_bytes=", len(bundle))
for needle in needles:
    print(f"{needle.decode()}: {bundle.find(needle)}")
