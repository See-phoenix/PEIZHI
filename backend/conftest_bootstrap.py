from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend root when running tests or uvicorn
load_dotenv(Path(__file__).resolve().parent / ".env")
