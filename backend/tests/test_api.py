from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import normalize_database_url

client=TestClient(app)

def test_health_and_tariff():
    assert client.get('/api/v1/health').status_code==200
    assert client.post('/api/v1/tariff/calculate',json={'consumption_kwh':51}).json()['estimated_energy_charges_inr']==156
    assert client.post('/api/v1/tariff/calculate',json={'consumption_kwh':-1}).status_code==422

def test_health_fails_when_database_is_unavailable():
    from unittest.mock import patch
    with patch('backend.app.main.engine.connect',side_effect=OSError('database offline')):
        assert client.get('/api/v1/health').status_code==503

def test_render_postgres_urls_select_psycopg_driver():
    assert normalize_database_url('postgres://user:pass@host/db') == 'postgresql+psycopg://user:pass@host/db'
    assert normalize_database_url('postgresql://user:pass@host/db') == 'postgresql+psycopg://user:pass@host/db'

def test_local_dashboard_origins_are_allowed_by_cors():
    for origin in ('http://localhost:3000','http://127.0.0.1:3000'):
        response=client.options('/api/v1/recommendations',headers={'Origin':origin,'Access-Control-Request-Method':'POST'})
        assert response.headers.get('access-control-allow-origin')==origin

def test_recommendations_without_inputs_are_honest():
    response=client.post('/api/v1/recommendations',json={})
    assert response.status_code==200
    assert response.json()['recommendations']==[]

def test_upload_rejects_wrong_mime():
    response=client.post('/api/v1/bills/upload',files={'file':('bill.txt',b'hello','text/plain')})
    assert response.status_code==415

def test_verified_bill_persists_and_overlaps_are_rejected():
    payload={'consumption_kwh':123.4,'period_start':'2040-01-01','period_end':'2040-01-30','billing_days':30,'total_amount_inr':987.65,'provenance':{'consumption_kwh':{'source':'user_verified'}}}
    created=client.post('/api/v1/bills/verify',json=payload)
    assert created.status_code==201,created.text
    bill_id=created.json()['id']
    assert client.get(f'/api/v1/bills/{bill_id}').json()['consumption_kwh']==123.4
    assert client.post('/api/v1/bills/verify',json={**payload,'period_start':'2040-01-20','billing_days':11}).status_code==409
    analytics=client.get('/api/v1/analytics/savings').json()
    assert any(point['bill_id']==bill_id and point['kwh_per_day']==4.113 for point in analytics['points'])

def test_analytics_empty_single_multiple_and_action_history():
    assert client.get('/api/v1/analytics/savings').json()['empty'] is True
    one={'consumption_kwh':100,'period_start':'2042-01-01','period_end':'2042-01-10','billing_days':10,'total_amount_inr':400}
    created=client.post('/api/v1/bills/verify',json=one)
    assert created.status_code==201
    assert client.get('/api/v1/analytics/savings').json()['bill_count']==1
    two={**one,'consumption_kwh':110,'period_start':'2042-02-01','period_end':'2042-02-20','billing_days':20}
    assert client.post('/api/v1/bills/verify',json=two).status_code==201
    analytics=client.get('/api/v1/analytics/savings').json()
    assert analytics['bill_count']==2 and len(analytics['observed_changes'])==1
    assert analytics['observed_changes'][0]['interpretation']=='Observed change only; no causal attribution.'
    action={'action_id':'review-energy-baseline','title':'Review baseline','expected_impact':'baseline only','impact_unit':'kWh/day','start_date':'2042-02-21'}
    assert client.post('/api/v1/actions',json=action).status_code==201
    assert len(client.get('/api/v1/actions').json())==1

def test_verified_bill_recommendation_action_analytics_workflow():
    bill=client.post('/api/v1/bills/verify',json={'consumption_kwh':210,'period_start':'2043-01-01','period_end':'2043-01-30','total_amount_inr':1200})
    assert bill.status_code==201
    result=client.post('/api/v1/recommendations',json={}).json()
    baseline=next(item for item in result['recommendations'] if item['action_id']=='review-energy-baseline')
    assert baseline['estimated_impact']['baseline_kwh_per_day']==7
    committed=client.post('/api/v1/actions',json={'action_id':baseline['action_id'],'title':baseline['title'],'expected_impact':'7 kWh/day baseline','impact_unit':'kWh/day','start_date':'2043-01-31'})
    assert committed.status_code==201
    proof=client.get('/api/v1/analytics/savings').json()
    assert proof['bill_count']==1 and proof['actions']==1

def test_ocr_reports_missing_tesseract_when_available_for_test():
    import shutil, io
    from PIL import Image
    if shutil.which('tesseract'): return
    image=Image.new('RGB',(16,16),'white'); data=io.BytesIO();image.save(data,format='PNG')
    response=client.post('/api/v1/bills/upload',files={'file':('bill.png',data.getvalue(),'image/png')})
    assert response.status_code==503
    assert 'Tesseract' in response.json()['detail']

def test_upload_rejects_mime_content_mismatch():
    import io
    from PIL import Image
    image=Image.new('RGB',(8,8),'white'); data=io.BytesIO();image.save(data,format='JPEG')
    response=client.post('/api/v1/bills/upload',files={'file':('bill.png',data.getvalue(),'image/png')})
    assert response.status_code==400
