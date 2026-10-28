import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.db import Base, get_db
from backend.app.main import app

@pytest.fixture(autouse=True)
def isolated_database(tmp_path):
    engine=create_engine(f"sqlite:///{tmp_path}/test.db",connect_args={"check_same_thread":False})
    Base.metadata.create_all(engine)
    Session=sessionmaker(bind=engine,expire_on_commit=False)
    def override():
        db=Session()
        try: yield db
        finally: db.close()
    app.dependency_overrides[get_db]=override
    yield
    app.dependency_overrides.clear()
    engine.dispose()
