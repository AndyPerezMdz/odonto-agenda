import { ICONOS, type Version } from "@/lib/novedades";

// Lista de versiones con sus novedades. La usan el aviso "¿Qué hay de nuevo?" y la página /novedades.
export default function ListaNovedades({ lista, conVersion = true, anclas = false }: { lista: Version[]; conVersion?: boolean; anclas?: boolean }) {
  return (
    <>
      {lista.map((v, i) => (
        <section key={v.version} id={anclas ? `v${v.version}` : undefined} className={`scroll-mt-6 ${i > 0 ? "mt-6 border-t border-line pt-5" : ""}`}>
          {conVersion && (
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Versión {v.version} · {v.fecha}
            </p>
          )}
          <ul className="flex flex-col gap-3.5">
            {v.items.map((n) => (
              <li key={n.titulo} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONOS[n.icono]} /></svg>
                </span>
                <span className="text-sm">
                  <b className="block">{n.titulo}</b>
                  <span className="text-muted">{n.texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
