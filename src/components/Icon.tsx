export function Icon({ name, size = 20 }: { name: 'pin' | 'arrow' | 'fuel' | 'check' | 'locate' | 'search' | 'refresh' | 'info'; size?: number }) {
  const paths: Record<typeof name, React.ReactNode> = {
    pin: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    fuel: <><path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M2 21h15M4 11h11M18 5l3 3v9a2 2 0 0 1-4 0v-3a2 2 0 0 0-2-2"/><path d="M19 6v4h2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    locate: <><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    refresh: <><path d="M20 7a9 9 0 1 0 1 8M20 2v6h-6"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
