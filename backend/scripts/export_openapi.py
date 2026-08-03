"""Export OpenAPI schema to packages/openapi/openapi.json"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.main import export_openapi  # noqa: E402


def main() -> None:
    target = ROOT.parent / "packages" / "openapi" / "openapi.json"
    path = export_openapi(target)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
