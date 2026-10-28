// 3.6 · Esqueletos de carga: la forma de la pantalla mientras llegan los datos (en vez de "Cargando…").

const H = ({ c = "", s }: { c?: string; s?: React.CSSProperties }) => <div className={`hueso ${/\brounded/.test(c) ? "" : "rounded-lg"} ${c}`} style={s} aria-hidden />;

/** Un día de agenda: encabezado y unos renglones con hora. */
export function EsqueletoDia({ renglones = 4 }: { renglones?: number }) {
  return (
    <div className="entrar" role="status" aria-label="Cargando">
      <H c="h-4 w-40" />
      <H c="mt-3 h-8 w-64 max-w-full" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: renglones }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-3">
            <H c="h-10 w-14 shrink-0" />
            <div className="flex-1">
              <H c="h-4" s={{ width: `${70 - i * 9}%` }} />
              <H c="mt-2 h-3" s={{ width: `${40 + i * 6}%` }} />
            </div>
          </div>
        ))}
      </div>
      <H c="mt-6 h-4 w-32" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <H c="h-24 rounded-2xl" />
        <H c="h-24 rounded-2xl" />
      </div>
    </div>
  );
}

/** Página completa (cuando el servidor todavía está armando la pantalla). */
export function EsqueletoPagina() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-5 sm:px-6 sm:pt-8">
      <div className="mb-5 flex items-center justify-between">
        <H c="h-5 w-28" />
        <div className="flex gap-2"><H c="h-9 w-9 rounded-full" /><H c="h-9 w-9 rounded-full" /></div>
      </div>
      <EsqueletoDia />
    </div>
  );
}
