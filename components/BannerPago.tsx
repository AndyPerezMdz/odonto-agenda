import Link from "next/link";
import type { EstadoPago } from "@/lib/pagos";
import { fechaLarga } from "@/lib/fechas";

// Aviso arriba de la agenda cuando la suscripción está por vencer o ya venció.
export default function BannerPago({ estado, esDueno }: { estado: EstadoPago; esDueno: boolean }) {
  if (estado.tipo === "cortesia" || estado.tipo === "activa") return null;

  const rojo = estado.tipo === "vencida" || estado.tipo === "gracia";
  let texto: React.ReactNode;
  if (estado.tipo === "por_vencer") {
    texto = estado.dias === 0 ? <>Tu suscripción <b>vence hoy</b>.</> : <>Tu suscripción vence en <b>{estado.dias} día{estado.dias === 1 ? "" : "s"}</b> ({fechaLarga(estado.vence)}).</>;
  } else if (estado.tipo === "gracia") {
    texto = <>La suscripción venció el {fechaLarga(estado.vence)}. El <b>{fechaLarga(estado.bloqueo)}</b> la agenda quedará en sólo lectura.</>;
  } else {
    texto = <>La agenda está en <b>sólo lectura</b>: puedes ver las citas, pero no agendar ni editar. La suscripción venció el {fechaLarga(estado.vence)}.</>;
  }

  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
        rojo
          ? "border-[#e8b4b0] bg-[#fbecea] text-[#7a1f1a] dark:border-[#5a2a27] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]"
          : "border-[#e8c36a] bg-[#fdf6e3] text-[#5c4712] dark:border-[#6b5620] dark:bg-[#2a2415] dark:text-[#ecd9a4]"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
      <p className="mr-auto">{texto} {!esDueno && "Avísale al dueño de la agenda."}</p>
      {esDueno && (
        <Link href="/personalizar#suscripcion" className="btn btn-sec shrink-0 py-1.5 text-xs">
          Ver cómo pagar
        </Link>
      )}
    </div>
  );
}
