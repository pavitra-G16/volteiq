import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CircleGauge, FileCheck2, Waves, Zap } from 'lucide-react';
import EnergyScene from './components/EnergyScene';

const steps = [
  { icon: FileCheck2, number: '01', title: 'Bring the bill', body: 'Upload a bill and review every extracted field before it becomes part of your history.' },
  { icon: Zap, number: '02', title: 'Find your next move', body: 'Explore ranked recommendations with their inputs, reasoning, and trade-offs in view.' },
  { icon: CircleGauge, number: '03', title: 'See what changed', body: 'Track later verified bills as observed changes, without confusing a trend with proof of cause.' },
];

export default function Home() {
  return <main className="landing-page">
    <nav className="landing-nav" aria-label="Main navigation">
      <Link className="landing-brand" href="/" aria-label="VolteIQ home"><span className="landing-brand-icon"><Waves size={19}/></span><span>Volte<span>IQ</span></span></Link>
      <div className="landing-links"><a href="#how-it-works">How it works</a><a href="#energy-model">Energy model</a></div>
      <Link className="nav-dashboard" href="/dashboard">Open dashboard <ArrowUpRight size={15}/></Link>
    </nav>

    <section className="landing-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="hero-kicker-dot"/> HOUSEHOLD ENERGY, IN FOCUS</div>
        <h1 id="hero-title">See Your Energy.<br/><span>Change Your Impact.</span></h1>
        <p className="hero-description">Turn electricity bills into explainable energy decisions, practical actions, and measurable changes over time.</p>
        <div className="hero-actions"><Link className="hero-primary" href="/dashboard">Explore My Energy <ArrowRight size={16}/></Link><a className="hero-secondary" href="#how-it-works">See How It Works <ArrowDown size={15}/></a></div>
        <div className="hero-proof"><span><Check size={13}/> Review before saving</span><span><Check size={13}/> Estimates clearly labelled</span></div>
      </div>
      <div className="hero-visual" aria-label="Interactive 3D model of a home energy network">
        <div className="hero-visual-glow"/><div className="hero-visual-grid"/>
        <EnergyScene />
        <div className="visual-caption"><span className="visual-live-dot"/> INTERACTIVE ENERGY MODEL <span className="caption-divider"/> SIMULATED VISUAL</div>
        <div className="visual-side-note">DRAG TO ORBIT<br/>SELECT A NODE TO EXPLORE</div>
      </div>
      <a className="scroll-cue" href="#how-it-works"><span>Scroll to explore</span><ArrowDown size={14}/></a>
    </section>

    <section className="proof-strip" aria-label="Product principles"><span>BUILT AROUND YOUR BILL</span><i/><span>EXPLAINABLE BY DESIGN</span><i/><span>OBSERVATIONS, NOT PROMISES</span></section>

    <section className="how-section" id="how-it-works">
      <div className="section-heading"><div><span className="section-eyebrow">A clearer energy loop</span><h2>Understand. Improve. <span>Prove.</span></h2></div><p>Every recommendation starts with visible inputs. Every comparison comes from saved records.</p></div>
      <div className="steps-grid">{steps.map(({icon:Icon,number,title,body})=><article className="step-card" key={number}><div className="step-card-top"><span className="step-icon"><Icon size={18}/></span><span className="step-number">{number}</span></div><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>

    <section className="model-section" id="energy-model">
      <div className="model-copy"><span className="section-eyebrow">Explore the system</span><h2>A living model of the home energy loop.</h2><p>Select a node to see how household inputs, a possible action, and later observations fit together. The scene is illustrative; your actual data stays in the dashboard.</p><Link href="/dashboard" className="model-link">Go to your dashboard <ArrowRight size={15}/></Link></div>
      <div className="model-legend"><span><i className="legend-dot solar"/>Solar input</span><span><i className="legend-dot home"/>Household use</span><span><i className="legend-dot grid"/>Grid connection</span><small>3D scene is an illustrative model, not a live meter.</small></div>
    </section>

    <footer className="landing-footer"><Link className="landing-brand" href="/" aria-label="VolteIQ home"><span className="landing-brand-icon"><Waves size={17}/></span><span>Volte<span>IQ</span></span></Link><span>Intelligence Behind Every Unit.</span><Link href="/dashboard">Open dashboard <ArrowUpRight size={13}/></Link></footer>
  </main>;
}
