import pytest
from backend.app.engines import tariff, recommendations
from backend.app.ocr import extract_candidates

@pytest.mark.parametrize("units,total",[(0,0),(50,152.5),(51,156),(100,327.5),(101,331.65),(250,950),(251,955.2)])
def test_tariff_boundaries(units,total):
    result=tariff(units)
    assert result["estimated_energy_charges_inr"]==total

@pytest.mark.parametrize("value",[-1,float("nan"),float("inf"),"bad"])
def test_tariff_rejects_invalid(value):
    with pytest.raises(ValueError): tariff(value)

def test_tariff_decimal_rounding():
    assert tariff("0.333")['estimated_energy_charges_inr']==1.02

def test_recommendations_are_deterministic_and_shift_is_not_energy_reduction():
    data={"appliance_watts":1000,"hours_per_use":2,"uses_per_week":3}
    a=recommendations(data,None); b=recommendations(data,None)
    assert a==b
    assert a[0]["estimated_impact"]["energy_kwh_per_week"]==6
    assert a[0]["estimated_impact"]["bill_saving_inr_per_week"] is None

def test_solar_needs_all_user_assumptions():
    assert recommendations({"solar_capacity_kw":2},None)==[]

def test_ocr_candidates_use_labeled_period_and_derive_days():
    fields=extract_candidates("""Electricity consumption 284 kWh
Total amount due Rs. 1,250.50
Bill date 02/09/2026
Billing Period 01/09/2026 to 30/09/2026
""")
    assert fields["consumption_kwh"]["value"]==284
    assert fields["total_amount_inr"]["value"]==1250.5
    assert fields["billing_period"]["value"]==["2026-09-01","2026-09-30"]
    assert fields["billing_days"]["value"]==30
    assert fields["billing_days"]["status"]=="derived_from_period_candidate"

def test_ocr_ignores_unlabeled_dates_and_flags_conflicting_periods():
    one=extract_candidates("Bill date 01/09/2026\nDue date 15/09/2026")
    assert one["billing_period"]["status"]=="missing"
    multiple=extract_candidates("Billing Period 01/09/2026 to 30/09/2026\nBilling Period 02/09/2026 to 01/10/2026")
    assert multiple["billing_period"]["value"] is None
    assert multiple["billing_period"]["status"]=="conflicting"
