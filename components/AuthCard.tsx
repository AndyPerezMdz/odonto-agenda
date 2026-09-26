export default function AuthCard({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-7 shadow-sm">
        <div className="mb-6">
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-muted">{subtitulo}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
