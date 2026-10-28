from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json, os
from dataclasses import dataclass
from typing import Any

DEFAULT_SLABS = ((Decimal("50"), Decimal("3.05")), (Decimal("50"), Decimal("3.50")), (Decimal("150"), Decimal("4.15")), (None, Decimal("5.20")))
def load_slabs() -> tuple:
    raw=os.getenv("TARIFF_SLABS_JSON")
    if not raw: return DEFAULT_SLABS
    try:
        data=json.loads(raw)
        if not isinstance(data,list) or len(data)<1: raise ValueError()
        rows=[]
        for i,item in enumerate(data):
            if not isinstance(item,list) or len(item)!=2: raise ValueError()
            bound=None if item[0] is None else Decimal(str(item[0]))
            rate=Decimal(str(item[1]))
            if not rate.is_finite() or rate<=0 or (bound is not None and (not bound.is_finite() or bound<=0)): raise ValueError()
            if (i==len(data)-1) != (bound is None): raise ValueError()
            rows.append((bound,rate))
        return tuple(rows)
    except Exception as e: raise RuntimeError("TARIFF_SLABS_JSON must be a JSON list of [positive_units, positive_rate] pairs ending with [null, positive_rate].") from e
SLABS = load_slabs()
CONFIG_ID = os.getenv("TARIFF_CONFIG_ID", "gujarat-illustrative-2026-01")
PAISE = Decimal("0.01")

def tariff(consumption: Any) -> dict:
    try: units = Decimal(str(consumption))
    except (InvalidOperation, ValueError, TypeError): raise ValueError("consumption_kwh must be a finite non-negative number")
    if not units.is_finite() or units < 0: raise ValueError("consumption_kwh must be a finite non-negative number")
    remaining, total, details = units, Decimal(0), []
    for cap, rate in SLABS:
        charged = remaining if cap is None else min(remaining, cap)
        charge = (charged * rate).quantize(PAISE, rounding=ROUND_HALF_UP)
        details.append({"rate_inr_per_kwh": str(rate), "units": float(charged), "charge_inr": float(charge)})
        total += charge; remaining -= charged
    total = total.quantize(PAISE, rounding=ROUND_HALF_UP)
    return {"consumption_kwh": float(units), "slabs": details, "estimated_energy_charges_inr": float(total), "effective_rate_inr_per_kwh": float(total / units) if units else 0, "tariff_config_id": CONFIG_ID, "limitations": "Illustrative energy charges only; excludes fixed charges, duty, taxes, subsidies and other adjustments."}

def recommendations(data: dict, latest_bill: dict | None) -> list[dict]:
    out = []
    if data.get("appliance_watts") and data.get("hours_per_use") and data.get("uses_per_week"):
        kwh = data["appliance_watts"] * data["hours_per_use"] * data["uses_per_week"] / 1000
        has_tou = data.get("tou_saving_per_kwh") is not None
        saving = kwh * data["tou_saving_per_kwh"] if has_tou else None
        out.append({"action_id":"shift-appliance-usage", "title":"Shift flexible appliance use", "description":"Move flexible use to the proposed lower-price window if your tariff supports it.", "why":"Appliance power and weekly usage were supplied explicitly.", "estimated_impact":{"energy_kwh_per_week":round(kwh,3),"bill_saving_inr_per_week":round(saving,2) if saving is not None else None,"type":"load_shift; kWh is unchanged"}, "inputs_and_assumptions":{"watts":data["appliance_watts"],"hours_per_use":data["hours_per_use"],"uses_per_week":data["uses_per_week"],"tou_difference_inr_per_kwh":data.get("tou_saving_per_kwh")}, "confidence":{"label":"Input-based scenario","basis":"Calculated from user-supplied appliance inputs; financial impact omitted without a supplied TOU price difference."}, "calculation":"watts × hours × uses/week ÷ 1000; optional bill effect = kWh × supplied tariff differential.", "limitations":"Scheduling changes timing, not energy consumption. No saving is claimed without a supported user-supplied TOU differential.", "score":70 if has_tou else 45})
    solar_fields = ("roof_area_m2", "solar_capacity_kw", "generation_kwh_per_kw_year", "electricity_rate_inr", "installed_cost_inr")
    if all(data.get(k) is not None for k in solar_fields):
        gen = data["solar_capacity_kw"] * data["generation_kwh_per_kw_year"]
        annual_savings = gen * data["electricity_rate_inr"]
        payback = data["installed_cost_inr"] / annual_savings if annual_savings > 0 else None
        out.append({"action_id":"assess-rooftop-solar", "title":"Assess rooftop solar feasibility", "description":"Review a user-input generation and cost scenario before seeking a site-specific quote.", "why":"Capacity, generation assumption, energy rate, and installed cost were provided.", "estimated_impact":{"generation_kwh_per_year":round(gen,1),"gross_bill_offset_inr_per_year":round(annual_savings,2),"simple_payback_years":round(payback,1) if payback else None}, "inputs_and_assumptions":{k:data[k] for k in solar_fields}, "confidence":{"label":"Assumption-driven scenario","basis":"All solar values are user-supplied; no irradiation, current market price, or subsidy source was consulted."}, "calculation":"capacity × assumed generation per kW-year; generation × supplied rate; cost ÷ gross annual offset.", "limitations":"Actual output, self-consumption, export credit, maintenance, roof constraints, taxes and eligibility can materially change results. No subsidy included.", "score":60})
    if latest_bill:
        out.append({"action_id":"review-energy-baseline", "title":"Review your verified energy baseline", "description":"Use the saved bill as the baseline for tracking future normalized consumption.", "why":f"Latest verified bill records {latest_bill['consumption_kwh']} kWh over {latest_bill['billing_days']} days.", "estimated_impact":{"baseline_kwh_per_day":round(latest_bill["consumption_kwh"]/latest_bill["billing_days"],3)}, "inputs_and_assumptions":{"verified_bill_id":latest_bill["id"],"consumption_kwh":latest_bill["consumption_kwh"],"billing_days":latest_bill["billing_days"]}, "confidence":{"label":"Verified record","basis":"Values come from a bill explicitly verified and saved by the user."}, "calculation":"verified consumption ÷ billing days.", "limitations":"A baseline does not imply that a later change was caused by any action.", "score":50})
    for rec in out:
        rec["_score"] = rec.pop("score")
        rec["ranking"] = {"score":rec["_score"],"factors":"Fixed deterministic points: appliance with supplied TOU differential 70; appliance without it 45; solar scenario with all required inputs 60; verified baseline 50."}
    out.sort(key=lambda r:(-r["_score"], r["action_id"]))
    for rank, rec in enumerate(out,1): rec["rank"] = rank; rec.pop("_score")
    return out
