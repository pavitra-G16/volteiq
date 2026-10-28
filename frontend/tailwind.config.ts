import type { Config } from 'tailwindcss';
export default { content: ['./app/**/*.{js,ts,jsx,tsx}'], theme: { extend: { colors: { ink: '#07121c', panel: '#10222e', teal: '#50d8bd', mint: '#a8f0d8', lime: '#c0df58' }, boxShadow: { card: '0 15px 45px rgba(0,0,0,.15)' } } }, plugins: [] } satisfies Config;
