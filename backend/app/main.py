import io, os, shutil
from datetime import date
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from PIL import Image, ImageOps, UnidentifiedImageError
from .db import Base, engine, get_db, Bill, Action
from .engines import tariff, recommendations
from .ocr import extract_candidates

Base.metadata.create_all(bind=engine)
app = FastAPI(title="VolteIQ", version="1.0.0", description="AI-powered household energy intelligence API with explainable recommendations and observed savings analytics")
origins=[v.strip() for v in os.getenv("CORS_ORIGINS","http://localhost:3000,http://127.0.0.1:3000").split(",") if v.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET","POST"], allow_headers=["Content-Type"])
OWNER=os.getenv("DEMO_OWNER_ID","demo")

class VerifyIn(BaseModel):
    model_config=ConfigDict(allow_inf_nan=False)
    consumption_kwh: float = Field(gt=0, le=100000)
    period_start: date
    period_end: date
    billing_days: int | None = Field(default=None, gt=0, le=366)
    total_amount_inr: float = Field(ge=0, le=100000000)
    provenance: dict = Field(default_factory=dict)
    @model_validator(mode="after")
    def dates(self):
        if self.period_end < self.period_start: raise ValueError("period_end must be on or after period_start")
        days=(self.period_end-self.period_start).days+1
        if self.billing_days is not None and self.billing_days != days: raise ValueError("billing_days must match the inclusive billing-period dates")
        self.billing_days=days
        return self

class TariffIn(BaseModel):
    model_config=ConfigDict(allow_inf_nan=False)
    consumption_kwh: float
class RecommendationIn(BaseModel):
    model_config=ConfigDict(allow_inf_nan=False)
    appliance_watts: float | None = Field(default=None, gt=0, le=100000)
    hours_per_use: float | None = Field(default=None, gt=0, le=24)
    uses_per_week: float | None = Field(default=None, gt=0, le=1000)
    tou_saving_per_kwh: float | None = Field(default=None, ge=0, le=100000)
    roof_area_m2: float | None = Field(default=None, gt=0)
    solar_capacity_kw: float | None = Field(default=None, gt=0)
    installed_cost_inr: float | None = Field(default=None, gt=0)
    generation_kwh_per_kw_year: float | None = Field(default=None, gt=0)
    electricity_rate_inr: float | None = Field(default=None, gt=0)
class ActionIn(BaseModel):
    action_id: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=240)
    expected_impact: str = Field(min_length=1, max_length=300)
    impact_unit: str = Field(min_length=1, max_length=80)
    start_date: date
class ORMModel(BaseModel): model_config=ConfigDict(from_attributes=True)
class BillOut(ORMModel):
    id:int; consumption_kwh:float; period_start:date; period_end:date; billing_days:int; total_amount_inr:float; verified:bool; provenance:dict
class ActionOut(ORMModel):
    id:int; action_id:str; title:str; expected_impact:str; impact_unit:str; start_date:date; status:str

@app.get("/api/v1/health")
def health():
    import pytesseract
    cmd=os.getenv("TESSERACT_CMD")
    if cmd: pytesseract.pytesseract.tesseract_cmd=cmd
    ocr_ok=bool(shutil.which(cmd or "tesseract"))
    try:
        with engine.connect() as connection: connection.execute(text("SELECT 1"))
        database_ok=True
    except Exception: database_ok=False
    if not database_ok:
        raise HTTPException(503,"Database is unavailable.")
    return {"status":"ok" if database_ok else "degraded","database_available":database_ok,"ocr_available":ocr_ok,"ocr_note":None if ocr_ok else "Install Tesseract and configure TESSERACT_CMD for bill OCR."}

@app.post("/api/v1/bills/upload")
async def upload(file:UploadFile=File(...)):
    max_bytes=int(os.getenv("UPLOAD_MAX_BYTES","5242880")); max_pixels=int(os.getenv("MAX_IMAGE_PIXELS","20000000"))
    allowed={"image/png","image/jpeg","image/tiff"}
    if file.content_type not in allowed: raise HTTPException(415,"Upload a PNG, JPEG, or TIFF image.")
    raw=await file.read(max_bytes+1)
    if len(raw)>max_bytes: raise HTTPException(413,"Image exceeds the configured upload size limit.")
    try:
        Image.MAX_IMAGE_PIXELS=max_pixels
        im=Image.open(io.BytesIO(raw)); im.verify()
        im=Image.open(io.BytesIO(raw))
        if im.format not in {"PNG","JPEG","TIFF"}: raise ValueError("Unsupported image content")
        expected={"image/png":"PNG","image/jpeg":"JPEG","image/tiff":"TIFF"}[file.content_type]
        if im.format != expected: raise ValueError("Image content does not match declared MIME type")
        if im.width*im.height>max_pixels: raise ValueError("Image dimensions exceed configured limit")
        im=ImageOps.exif_transpose(im).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as e: raise HTTPException(400,f"Invalid or unsafe image: {e}")
    import pytesseract
    cmd=os.getenv("TESSERACT_CMD")
    if cmd: pytesseract.pytesseract.tesseract_cmd=cmd
    if not shutil.which(cmd or "tesseract"): raise HTTPException(503,"Tesseract OCR is unavailable. Install it and configure TESSERACT_CMD.")
    try: text=pytesseract.image_to_string(im, timeout=20)
    except Exception as e: raise HTTPException(422,"OCR processing failed. Check image quality and Tesseract configuration.") from e
    if not text.strip(): raise HTTPException(422,"No readable text was detected. Try a sharper, well-lit bill image.")
    # Candidate matching is intentionally conservative; source snippets are limited to the selected value line.
    return {"ocr_performed":True,"fields":extract_candidates(text),"review_required":True,"note":"OCR candidates require user review; field confidence is heuristic, not a calibrated probability."}

@app.post("/api/v1/bills/verify",response_model=BillOut,status_code=201)
def verify(data:VerifyIn, db:Session=Depends(get_db)):
    overlaps=db.scalar(select(Bill).where(Bill.owner_id==OWNER, Bill.period_start<=data.period_end, Bill.period_end>=data.period_start))
    if overlaps: raise HTTPException(409,"Billing period overlaps an existing saved bill. Review history and correct the period deliberately.")
    row=Bill(owner_id=OWNER,consumption_kwh=data.consumption_kwh,period_start=data.period_start,period_end=data.period_end,billing_days=data.billing_days,total_amount_inr=data.total_amount_inr,verified=True,provenance=data.provenance)
    db.add(row)
    try: db.commit(); db.refresh(row)
    except Exception: db.rollback(); raise HTTPException(409,"Could not save bill because its billing period conflicts with existing data.")
    return row

@app.get("/api/v1/bills",response_model=list[BillOut])
def bills(db:Session=Depends(get_db)): return list(db.scalars(select(Bill).where(Bill.owner_id==OWNER).order_by(Bill.period_start)).all())
@app.get("/api/v1/bills/{bill_id}",response_model=BillOut)
def bill_detail(bill_id:int,db:Session=Depends(get_db)):
    row=db.scalar(select(Bill).where(Bill.id==bill_id,Bill.owner_id==OWNER))
    if not row: raise HTTPException(404,"Bill not found")
    return row
@app.post("/api/v1/tariff/calculate")
def tariff_calculate(data:TariffIn):
    try:return tariff(data.consumption_kwh)
    except ValueError as e:raise HTTPException(422,str(e))
@app.post("/api/v1/recommendations")
def recommend(data:RecommendationIn,db:Session=Depends(get_db)):
    row=db.scalar(select(Bill).where(Bill.owner_id==OWNER).order_by(Bill.period_end.desc()))
    latest={"id":row.id,"consumption_kwh":row.consumption_kwh,"billing_days":row.billing_days} if row else None
    missing=[]
    appliance=("appliance_watts","hours_per_use","uses_per_week")
    solar=("roof_area_m2","solar_capacity_kw","generation_kwh_per_kw_year","electricity_rate_inr","installed_cost_inr")
    if any(data.model_dump().get(k) is not None for k in appliance) and not all(data.model_dump().get(k) is not None for k in appliance): missing.append("Appliance scenario needs appliance_watts, hours_per_use, and uses_per_week.")
    if any(data.model_dump().get(k) is not None for k in solar) and not all(data.model_dump().get(k) is not None for k in solar): missing.append("Solar scenario needs roof_area_m2, solar_capacity_kw, generation_kwh_per_kw_year, electricity_rate_inr, and installed_cost_inr.")
    return {"recommendations":recommendations(data.model_dump(),latest),"notices":missing,"basis":"Deterministic, transparent scenarios; not validated AI predictions."}
@app.post("/api/v1/actions",response_model=ActionOut,status_code=201)
def create_action(data:ActionIn,db:Session=Depends(get_db)):
    row=Action(owner_id=OWNER,**data.model_dump()); db.add(row); db.commit(); db.refresh(row); return row
@app.get("/api/v1/actions",response_model=list[ActionOut])
def actions(db:Session=Depends(get_db)): return list(db.scalars(select(Action).where(Action.owner_id==OWNER).order_by(Action.start_date.desc())).all())
@app.get("/api/v1/analytics/savings")
def analytics(db:Session=Depends(get_db)):
    rows=list(db.scalars(select(Bill).where(Bill.owner_id==OWNER,Bill.verified.is_(True)).order_by(Bill.period_start)).all())
    points=[{"bill_id":r.id,"period_start":r.period_start,"period_end":r.period_end,"billing_days":r.billing_days,"consumption_kwh":r.consumption_kwh,"kwh_per_day":round(r.consumption_kwh/r.billing_days,3),"total_amount_inr":r.total_amount_inr} for r in rows]
    deltas=[]
    for prev,cur in zip(points,points[1:]): deltas.append({"from_bill_id":prev["bill_id"],"to_bill_id":cur["bill_id"],"kwh_per_day_change":round(cur["kwh_per_day"]-prev["kwh_per_day"],3),"interpretation":"Observed change only; no causal attribution."})
    return {"bill_count":len(points),"points":points,"observed_changes":deltas,"actions":len(actions(db)),"empty":not points}
