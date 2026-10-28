'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, Bolt, Check, ChevronDown, CircleHelp, FileUp, Leaf, LoaderCircle, RefreshCw, Sparkles, Waves, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EnergyScene from '../components/EnergyScene';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
type Bill = { id: number; consumption_kwh: number; period_start: string; period_end: string; billing_days: number; total_amount_inr: number; verified: boolean; provenance: Record<string, unknown> };
type Action = { id: number; action_id: string; title: string; expected_impact: string; impact_unit: string; start_date: string; status: string };
type Candidate = { value: number | string[] | null; status: string; evidence: string | null };
type Recommendation = { action_id: string; title: string; description: string; why: string; estimated_impact: Record<string, number | string | null>; inputs_and_assumptions: Record<string, unknown>; confidence: { label: string; basis: string }; calculation: string; limitations: string; rank: number; ranking: { score: number; factors: string } };
type Point = { bill_id: number; period_start: string; period_end: string; billing_days: number; consumption_kwh: number; kwh_per_day: number; total_amount_inr: number };
type Analytics = { bill_count: number; points: Point[]; observed_changes: Array<{ from_bill_id: number; to_bill_id: number; kwh_per_day_change: number; interpretation: string }>; empty: boolean };
type Tariff = { estimated_energy_charges_inr: number; effective_rate_inr_per_kwh: number; tariff_config_id: string; slabs: Array<{ rate_inr_per_kwh: string; units: number; charge_inr: number }>; limitations: string };
type DashboardForm = { consumption_kwh: string; period_start: string; period_end: string; billing_days: string; total_amount_inr: string };
const emptyForm: DashboardForm = { consumption_kwh: '', period_start: '', period_end: '', billing_days: '', total_amount_inr: '' };
const scenarioFields = [
  ['appliance_watts', 'Appliance power', 'W'], ['hours_per_use', 'Hours per use', 'hours'], ['uses_per_week', 'Uses per week', 'uses'],
  ['tou_saving_per_kwh', 'TOU price difference', '₹ / kWh'], ['roof_area_m2', 'Usable roof area', 'm²'], ['solar_capacity_kw', 'Solar capacity', 'kW'],
  ['generation_kwh_per_kw_year', 'Assumed generation', 'kWh / kW-year'], ['installed_cost_inr', 'Installed cost assumption', '₹'], ['electricity_rate_inr', 'Electricity rate', '₹ / kWh'],
] as const;

export default function Dashboard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationNotices, setRecommendationNotices] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<Record<string, Candidate> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<DashboardForm>(emptyForm);
  const [scenario, setScenario] = useState<Record<string, string>>(Object.fromEntries(scenarioFields.map(([key]) => [key, ''])));
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(API + path, init);
    const data = await response.json().catch(() => ({ detail: 'The server returned an unreadable response.' }));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data as T;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setRetryAction(null);
    try {
      const [savedBills, savedActions, savedAnalytics] = await Promise.all([
        request<Bill[]>('/api/v1/bills'), request<Action[]>('/api/v1/actions'), request<Analytics>('/api/v1/analytics/savings'),
      ]);
      setBills(savedBills); setActions(savedActions); setAnalytics(savedAnalytics);
      if (savedBills.length) {
        const estimate = await request<Tariff>('/api/v1/tariff/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consumption_kwh: savedBills[savedBills.length - 1].consumption_kwh }) });
        setTariff(estimate);
      } else setTariff(null);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load saved energy data.');
      setRetryAction(() => () => { void refresh(); });
    }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const latest = bills[bills.length - 1];

  async function upload() {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Choose an image under 5 MB.'); return; }
    if (!['image/png', 'image/jpeg', 'image/tiff'].includes(file.type)) { setError('Choose a PNG, JPEG, or TIFF bill image.'); return; }
    setBusy('upload'); setError(''); setMessage(''); setRetryAction(null);
    try {
      const body = new FormData(); body.append('file', file);
      const response = await fetch(API + '/api/v1/bills/upload', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `Upload failed (${response.status})`);
      const fields = data.fields as Record<string, Candidate>;
      setCandidate(fields);
      const period = fields.billing_period?.value;
      setForm({ ...emptyForm,
        consumption_kwh: typeof fields.consumption_kwh?.value === 'number' ? String(fields.consumption_kwh.value) : '',
        total_amount_inr: typeof fields.total_amount_inr?.value === 'number' ? String(fields.total_amount_inr.value) : '',
        billing_days: typeof fields.billing_days?.value === 'number' ? String(fields.billing_days.value) : '',
        period_start: Array.isArray(period) ? period[0] : '', period_end: Array.isArray(period) ? period[1] : '',
      });
      setMessage('OCR completed. Review the candidate values and confirm the bill details before saving.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bill upload failed. You can retry the upload.');
      setRetryAction(() => () => { void upload(); });
    }
    finally { setBusy(''); }
  }

  async function verify() {
    setBusy('verify'); setError(''); setMessage(''); setRetryAction(null);
    try {
      const provenance = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, { source: provenanceFor(key, value, candidate) }]));
      await request<Bill>('/api/v1/bills/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consumption_kwh: Number(form.consumption_kwh), period_start: form.period_start, period_end: form.period_end, billing_days: form.billing_days ? Number(form.billing_days) : undefined, total_amount_inr: Number(form.total_amount_inr), provenance }) });
      setCandidate(null); setFile(null); setForm(emptyForm); setMessage('Bill verified and saved to your history.'); await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bill verification failed. Correct the fields and retry.');
      setRetryAction(() => () => { void verify(); });
    }
    finally { setBusy(''); }
  }

  async function calculateRecommendations() {
    setBusy('recommendations'); setError(''); setMessage(''); setRetryAction(null);
    try {
      const inputs = Object.fromEntries(Object.entries(scenario).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)]));
      const result = await request<{ recommendations: Recommendation[]; notices: string[] }>('/api/v1/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs) });
      setRecommendations(result.recommendations); setRecommendationNotices(result.notices);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not calculate recommendations.');
      setRetryAction(() => () => { void calculateRecommendations(); });
    }
    finally { setBusy(''); }
  }

  async function commitAction(recommendation: Recommendation) {
    setBusy(recommendation.action_id); setError(''); setRetryAction(null);
    try {
      await request<Action>('/api/v1/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action_id: recommendation.action_id, title: recommendation.title, expected_impact: JSON.stringify(recommendation.estimated_impact), impact_unit: 'See scenario impact fields', start_date: new Date().toISOString().slice(0, 10) }) });
      setMessage('Action committed and added to your tracker.'); await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this action.');
      setRetryAction(() => () => { void commitAction(recommendation); });
    }
    finally { setBusy(''); }
  }

  return <main className="min-h-screen px-4 pb-12 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1440px]">
    <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/[.08] bg-ink/90 px-4 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <a href="#overview" className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal" aria-label="VolteIQ dashboard home"><span className="brand-mark"><Waves size={23} strokeWidth={2.4}/></span><span><span className="block text-lg font-semibold tracking-tight">Volte<span className="text-teal">IQ</span></span><span className="block text-[10px] tracking-[.17em] text-slate-400">INTELLIGENCE BEHIND EVERY UNIT.</span></span></a>
      <nav aria-label="Dashboard sections" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300 sm:text-sm"><a className="nav-link" href="#overview">Overview</a><a className="nav-link" href="#verify">Verify bill</a><a className="nav-link" href="#decide">Recommendations</a><a className="nav-link" href="#track">Action tracker</a></nav>
      <span className="hidden items-center gap-2 rounded-full border border-lime/20 bg-lime/[.06] px-3 py-1.5 text-[10px] font-medium tracking-wider text-lime sm:flex"><span className="status-dot"/> LOCAL DEMO</span>
    </header>

    <section id="overview" className="dashboard-overview-band scroll-mt-24">
      <div className="dashboard-overview-copy animate-rise"><div className="eyebrow flex items-center gap-2"><Sparkles size={14}/> Household Energy Intelligence</div><h1>See Your Energy.<br/><span>Change Your Impact.</span></h1><p>Turn your electricity bill into clear next steps, then track what changes over time.</p><a className="dashboard-overview-cta" href="#verify">Explore My Energy <ArrowDownRight size={15}/></a><div className="dashboard-data-scope"><BadgeCheck size={15}/><span>Verified household records</span><i/>Estimates labelled</div></div>
      <div className="dashboard-scene-card" aria-label="Illustrative 3D energy flow model"><div className="dashboard-scene-label"><span className="visual-live-dot"/> ENERGY FLOW <span>ILLUSTRATIVE MODEL</span></div><EnergyScene variant="compact"/></div>
    </section>

    {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-100"><span>{error}</span>{retryAction && <button className="outline-button flex items-center gap-2" onClick={retryAction}><RefreshCw size={14}/> Retry</button>}</div>}
    {message && <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-teal/20 bg-teal/[.06] px-4 py-3 text-sm text-teal"><Check size={16}/>{message}</div>}

    <section aria-label="Monthly energy overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<Zap size={17}/>} label="Verified consumption" value={latest ? `${latest.consumption_kwh.toLocaleString('en-IN')} kWh` : '—'} detail={latest ? `${latest.period_start} – ${latest.period_end} · ${latest.billing_days} days` : 'Upload a bill to establish a baseline'} accent="teal"/>
      <Metric icon={<FileUp size={17}/>} label="Latest bill amount" value={latest ? rupees(latest.total_amount_inr) : '—'} detail={latest ? 'User-verified bill total' : 'No saved billing records'} accent="lime"/>
      <Metric icon={<Leaf size={17}/>} label="Estimated energy charge" value={tariff ? rupees(tariff.estimated_energy_charges_inr) : '—'} detail={tariff ? 'Illustrative slab estimate · excludes other charges' : 'Available after bill verification'} accent="teal"/>
      <Metric icon={<Activity size={17}/>} label="Actions being tracked" value={String(actions.length)} detail={actions.length ? 'Saved commitments' : 'Commit an action to start tracking'} accent="lime"/>
    </section>
    {tariff && <details className="group mt-3 rounded-xl border border-white/[.08] bg-panel/60 px-4 py-3 text-xs text-slate-400"><summary className="flex cursor-pointer list-none items-center gap-2"><ChevronDown size={14} className="text-teal transition-transform group-open:rotate-180"/>Tariff breakdown · {tariff.tariff_config_id}<span className="ml-auto">Effective rate {tariff.effective_rate_inr_per_kwh.toFixed(2)} ₹/kWh</span></summary><div className="mt-3 grid gap-2 border-t border-white/[.07] pt-3 sm:grid-cols-4">{tariff.slabs.map((slab, index) => <div key={`${slab.rate_inr_per_kwh}-${index}`} className="flex justify-between gap-3"><span>Slab {index + 1} · {slab.units} units × ₹{slab.rate_inr_per_kwh}</span><span className="text-slate-200">₹{slab.charge_inr.toFixed(2)}</span></div>)}</div><p className="mt-2 text-slate-500">{tariff.limitations}</p></details>}

    <section className="mt-8 grid scroll-mt-24 gap-4 xl:grid-cols-[1.05fr_.95fr]" id="verify">
      <article className="surface p-5 sm:p-7"><SectionHeading step="01" title="Bring your bill into focus" subtitle="Upload a bill image, review the extracted candidates, then verify the values you want to save."/>
        <div className="bill-dropzone mt-5" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const dropped = event.dataTransfer.files?.[0]; if (dropped) { setFile(dropped); setError(''); } }}><label htmlFor="billfile" className="mb-2 block text-sm font-medium text-slate-200">Drop a bill image here or choose a file</label><input id="billfile" type="file" accept="image/png,image/jpeg,image/tiff" className="file-control" onChange={event => { setFile(event.target.files?.[0] || null); setError(''); }}/><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">PNG, JPEG or TIFF · 5 MB max · Tesseract OCR</span><button className="primary-button" onClick={() => void upload()} disabled={!file || Boolean(busy)}>{busy === 'upload' ? <><LoaderCircle className="animate-spin" size={16}/> Reading bill…</> : <><FileUp size={16}/> Upload and extract</>}</button></div>{busy === 'upload' && <div className="upload-progress" role="status"><span/><span>Uploading image and waiting for OCR response…</span></div>}{file && <p className="mt-3 truncate text-xs text-teal">Selected: {file.name}</p>}</div>
        {candidate ? <div className="mt-5 border-t border-white/[.08] pt-5"><div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-100"><CircleHelp size={16} className="text-teal"/>OCR candidates · review before saving</div><div className="grid gap-3 sm:grid-cols-2">{([['consumption_kwh', 'Consumption (kWh)', 'number'], ['period_start', 'Billing period start', 'date'], ['period_end', 'Billing period end', 'date'], ['billing_days', 'Billing days', 'number'], ['total_amount_inr', 'Bill total (₹)', 'number']] as const).map(([key, label, type]) => <label className="form-label" key={key}>{label}<input className="text-input mt-1.5" type={type} min={type === 'number' ? '0' : undefined} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })}/><span className="mt-1 block text-[11px] text-slate-500">{candidateFieldFor(key, candidate)?.value !== null && candidateFieldFor(key, candidate)?.value !== undefined ? fieldMatchesCandidate(key, form[key], candidate) ? 'OCR candidate — confirmed against the bill' : 'User-corrected value' : candidateFieldFor(key, candidate)?.status || 'Enter manually and verify'}</span>{candidateFieldFor(key, candidate)?.evidence && <span className="mt-1 block rounded-md bg-ink/70 px-2 py-1 text-[11px] text-slate-400">Evidence: {candidateFieldFor(key, candidate)?.evidence}</span>}</label>)}</div><button className="primary-button mt-4" onClick={() => void verify()} disabled={Boolean(busy) || !form.consumption_kwh || !form.period_start || !form.period_end || !form.total_amount_inr}>{busy === 'verify' ? <><LoaderCircle className="animate-spin" size={16}/> Saving verified bill…</> : <><Check size={16}/> Confirm and save bill</>}</button><p className="mt-2 text-xs text-slate-500">The server validates the billing dates and rejects overlapping periods.</p></div> : <p className="mt-4 text-xs text-slate-500">No bill content is saved during OCR. Only the values you explicitly confirm are persisted.</p>}
      </article>

      <article className="surface scroll-mt-24 p-5 sm:p-7" id="decide"><SectionHeading step="02" title="Choose a supported action" subtitle="Recommendations are scenarios based on the values you provide. Their rank and assumptions are shown."/>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{scenarioFields.map(([key, label, unit]) => <label className="form-label" key={key}>{label}<span className="float-right text-slate-500">{unit}</span><input className="text-input mt-1.5" type="number" min="0" step="any" value={scenario[key]} onChange={event => setScenario({ ...scenario, [key]: event.target.value })}/></label>)}</div>
        <button className="secondary-button mt-4" onClick={() => void calculateRecommendations()} disabled={Boolean(busy)}>{busy === 'recommendations' ? <><LoaderCircle className="animate-spin" size={16}/>Calculating scenarios…</> : <><Sparkles size={16}/>Rank recommendations</>}</button>
        <p className="mt-3 text-xs leading-5 text-slate-500">Appliance shifting changes timing, not kWh. Solar uses your assumptions only; no live irradiation, market pricing or subsidy data is included.</p>
        {recommendationNotices.map(notice => <p key={notice} role="status" className="mt-2 text-xs text-lime">{notice}</p>)}
        <div className="mt-5 space-y-3">{recommendations.map(item => <article className="recommendation-card" key={item.action_id}><div className="flex items-start justify-between gap-3"><div><span className="eyebrow">Priority {item.rank} · score {item.ranking.score} · {item.confidence.label}</span><h3 className="mt-1.5 text-base font-semibold text-slate-100">{item.title}</h3></div><button className="outline-button shrink-0" onClick={() => void commitAction(item)} disabled={Boolean(busy)}>{busy === item.action_id ? <LoaderCircle className="animate-spin" size={14}/> : 'Commit action'}</button></div><p className="mt-2 text-sm leading-5 text-slate-400">{item.why}</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(item.estimated_impact).map(([key, value]) => <span className="impact-chip" key={key}>{key.replaceAll('_', ' ')}: {value ?? 'not estimated'}</span>)}</div><details className="mt-3 text-xs text-slate-400"><summary className="cursor-pointer text-teal">Calculation, ranking, assumptions and limits</summary><p className="mt-2">{item.calculation}</p><p className="mt-2">{item.confidence.basis}</p><p className="mt-2">{item.ranking.factors}</p><p className="mt-2">{item.limitations}</p><pre className="mt-2 whitespace-pre-wrap font-sans text-slate-500">{JSON.stringify(item.inputs_and_assumptions, null, 2)}</pre></details></article>)}{!recommendations.length && <div className="empty-scenario">Enter complete scenario inputs and rank to see recommendations supported by those inputs.</div>}</div>
      </article>
    </section>

    <section className="mt-4 grid scroll-mt-24 gap-4 xl:grid-cols-[1.25fr_.75fr]" id="track">
      <article className="surface min-h-[350px] p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><SectionHeading step="03" title="Observed energy trend" subtitle="Saved, verified bills normalized by billing days. This is observed change, not causal proof."/><span className="rounded-lg border border-teal/15 bg-teal/[.05] px-2.5 py-1 text-xs text-teal">kWh / day</span></div>
        {loading ? <LoadingState label="Loading saved energy history…"/> : analytics?.empty ? <EmptyState title="Your history starts with a verified bill" text="Upload and verify a bill to create the first real data point. No chart values are invented."/> : analytics && <><div className="mt-5 h-56" role="img" aria-label={`${analytics.bill_count} saved verified bills plotted as daily energy consumption`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><defs><linearGradient id="energy-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#50d8bd" stopOpacity={0.28}/><stop offset="95%" stopColor="#50d8bd" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid stroke="#213744" strokeDasharray="4 5" vertical={false}/><XAxis dataKey="period_start" stroke="#8499a5" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/><YAxis stroke="#8499a5" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" kWh"/><Tooltip contentStyle={{ background: '#0b1a24', border: '1px solid #29434d', borderRadius: 12, color: '#e7f1f3' }} formatter={(value) => [`${value} kWh/day`, 'Normalized consumption']}/><Area type="monotone" dataKey="kwh_per_day" name="kWh/day" stroke="#50d8bd" strokeWidth={2.5} dot={{ r: 4, fill: '#50d8bd', stroke: '#0b1a24', strokeWidth: 2 }} fill="url(#energy-area)" activeDot={{ r: 5, fill: '#b8ec53', stroke: '#0b1a24' }}/></AreaChart></ResponsiveContainer></div><div className="mt-4 divide-y divide-white/[.06] border-y border-white/[.06]">{analytics.points.map(point => <div key={point.bill_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"><span className="text-slate-400">{point.period_start} – {point.period_end} <span className="text-slate-600">· {point.billing_days} days</span></span><span className="text-slate-200">{point.consumption_kwh} kWh <span className="ml-2 text-slate-500">{point.kwh_per_day} kWh/day</span></span></div>)}</div>{analytics.observed_changes.map(change => <p className="mt-3 flex items-center gap-2 text-xs text-slate-500" key={`${change.from_bill_id}-${change.to_bill_id}`}>{change.kwh_per_day_change > 0 ? <ArrowUpRight size={14} className="text-lime"/> : <ArrowDownRight size={14} className="text-teal"/>}Observed daily-use change {change.kwh_per_day_change > 0 ? '+' : ''}{change.kwh_per_day_change} kWh/day · no action causality inferred</p>)}</>}
      </article>
      <article className="surface p-5 sm:p-7"><SectionHeading step="04" title="Action tracker" subtitle="Commitments saved from your recommendations."/>{loading ? <LoadingState label="Loading actions…"/> : actions.length ? <div className="mt-5 space-y-3">{actions.map(action => <div className="action-row" key={action.id}><div className="flex items-start gap-3"><span className="action-icon"><Check size={15}/></span><div className="min-w-0"><h3 className="font-medium text-slate-100">{action.title}</h3><p className="mt-1 break-words text-xs leading-5 text-slate-400">Expected scenario: {formatImpact(action.expected_impact)}</p><p className="mt-2 text-[11px] uppercase tracking-wider text-slate-600">Started {action.start_date} · {action.status}</p></div></div></div>)}</div> : <EmptyState title="No actions committed yet" text="Choose a recommendation and commit it. Expected impact stays distinct from future observed bill changes."/>}</article>
    </section>
    <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-white/[.08] py-5 text-xs text-slate-500 sm:flex-row"><span>VolteIQ · Intelligence Behind Every Unit.</span><span>Illustrative tariff estimates · locally scoped demo · observed changes are not causal claims</span></footer>
  </div></main>;
}

function candidateFieldFor(name: string, fields: Record<string, Candidate> | null) { return name === 'period_start' || name === 'period_end' ? fields?.billing_period : fields?.[name]; }
function candidateValueFor(name: string, fields: Record<string, Candidate> | null): number | string | null { const field = candidateFieldFor(name, fields); if (name === 'period_start' || name === 'period_end') { const index = name === 'period_start' ? 0 : 1; return Array.isArray(field?.value) ? field.value[index] : null; } return typeof field?.value === 'number' ? field.value : null; }
function fieldMatchesCandidate(name: string, value: string, fields: Record<string, Candidate> | null) { const candidateValue = candidateValueFor(name, fields); if (candidateValue === null) return false; if (typeof candidateValue === 'number') return value !== '' && Number(value) === candidateValue; return value === candidateValue; }
function provenanceFor(name: string, value: string, fields: Record<string, Candidate> | null) { const field = candidateFieldFor(name, fields); if (!field || field.status === 'missing') return 'user_entered_verified'; return fieldMatchesCandidate(name, value, fields) ? 'ocr_candidate_user_verified' : 'user_corrected'; }
function Metric({ icon, label, value, detail, accent }: { icon: React.ReactNode; label: string; value: string; detail: string; accent: 'teal' | 'lime' }) {
  return <article className="metric-card"><div className="flex items-center justify-between"><span className="text-xs text-slate-400">{label}</span><span className={accent === 'teal' ? 'metric-icon-teal' : 'metric-icon-lime'}>{icon}</span></div><div className="mt-4 text-2xl font-semibold tracking-tight text-white">{value}</div><div className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</div></article>;
}
function SectionHeading({ step, title, subtitle }: { step: string; title: string; subtitle: string }) { return <div><div className="eyebrow">{step} / VolteIQ</div><h2 className="mt-1.5 text-xl font-semibold tracking-tight text-white">{title}</h2><p className="mt-1.5 max-w-xl text-xs leading-5 text-slate-400">{subtitle}</p></div>; }
function LoadingState({ label }: { label: string }) { return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-400"><LoaderCircle size={17} className="animate-spin text-teal"/>{label}</div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="flex min-h-48 flex-col items-center justify-center text-center"><span className="empty-icon"><Bolt size={20}/></span><h3 className="mt-3 text-sm font-medium text-slate-200">{title}</h3><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{text}</p></div>; }
function rupees(value: number) { return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
function formatImpact(value: string) { try { const parsed = JSON.parse(value) as Record<string, number | string | null>; return Object.entries(parsed).map(([key, amount]) => `${key.replaceAll('_', ' ')}: ${amount ?? 'not estimated'}`).join(' · '); } catch { return value; } }
