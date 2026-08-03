from sqlalchemy import text

from app.db import SessionLocal, init_db
from app.seed import seed_parts

init_db()
db = SessionLocal()
print("seed_inserted", seed_parts(db))
print("parts_total", db.execute(text("select count(*) from parts")).scalar())
print("servers", db.execute(text("select count(*) from parts where category='server'")).scalar())
db.close()
print("ok")
