import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'VolteIQ | Intelligence Behind Every Unit.', description: 'AI-powered household energy intelligence that transforms electricity bills into explainable recommendations and tracks observed energy changes over time.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
