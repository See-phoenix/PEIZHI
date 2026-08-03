from sqlalchemy import text

from app.db import SessionLocal, init_db
from app.seed import seed_parts

init_db()
db = SessionLocal()
print("inserted", seed_parts(db))
print("gpu", db.execute(text("select count(*) from parts where category='gpu'")).scalar())
print("total", db.execute(text("select count(*) from parts")).scalar())
db.close()
