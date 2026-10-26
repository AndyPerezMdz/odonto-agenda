// 2.9 · Novedades de Mi agenda ("¿Qué hay de nuevo?") y la bienvenida de 3 pasos.
// Al agregar algo nuevo: pon una versión ARRIBA. A quien ya entró le sale una vez.

export type NovedadMi = { e: string; t: string; x: string; pro?: boolean };
export const NOVEDADES_MI: { version: string; titulo: string; items: NovedadMi[] }[] = [
  {
    version: "3.4",
    titulo: "Sin señal, sin problema",
    items: [
      { e: "📶", t: "Funciona sin conexión", x: "Ábrela sin internet y ves lo último que tenías. Lo que anotes, palomees o borres sin señal se sube solo cuando vuelva." },
      { e: "🔒", t: "Ya no te saca", x: "Instalada en tu inicio, la sesión se mantiene aunque la señal falle o no la abras en días." },
    ],
  },
  {
    version: "3.2",
    titulo: "Rachas que no se rompen",
    items: [
      { e: "🧊", t: "Comodín de racha", x: "¿Se te pasó ayer? Usa tu comodín y tu racha sigue. Uno al mes (con Pro, uno por semana)." },
      { e: "🔥", t: "Hábitos con amigos", x: "En un hábito: “Hazlo con alguien”. Cada quien palomea el suyo y ven la racha del otro. Te avisa cuando tu amigo ya lo hizo." },
    ],
  },
  {
    version: "3.0",
    titulo: "Tu agenda, ahora en equipo",
    items: [
      { e: "👥", t: "Compartir", x: "Abre un evento o pendiente → “Compartir con alguien”. Lo ve en su agenda; los pendientes los puede palomear." },
      { e: "⏱", t: "Bloques de tiempo", x: "Ponle hora a un pendiente y aparece en tu día. Te sugiere los huecos libres y te avisa cuando toca." },
      { e: "🏷️", t: "Pendientes con prioridad y lista", x: "“Comprar focos #casa !!”: va a la lista Casa y como urgente. Filtra por lista." },
      { e: "🎤", t: "Díctalo", x: "Toca el micrófono en “Anotar algo” y dilo como lo dirías." },
      { e: "🔍", t: "Buscador", x: "Arriba (o tecla /): encuentra cualquier evento, pendiente, plan o pago." },
      { e: "📊", t: "Estadísticas de hábitos", x: "Mapa de 6 meses, % del mes y tu mejor día. En cada hábito." },
      { e: "🎥", t: "Links en tus eventos", x: "Pega el link de Zoom o Meet en las notas: sale “Unirse” en Hoy. Y “Cómo llegar” con el lugar." },
    ],
  },
  {
    version: "2.9",
    titulo: "Tu agenda, a tu modo",
    items: [
      { e: "🎁", t: "Invita a un amigo", x: "Si alguien crea su Mi agenda con tu link, los dos ganan un mes de Pro. Está en Ajustes." },
      { e: "🧩", t: "Arma tu Hoy", x: "Abajo de Hoy, “Personalizar”: oculta lo que no usas." },
      { e: "📦", t: "Tus datos", x: "Descárgalos o borra tu agenda tú solo, desde Ajustes." },
    ],
  },
  {
    version: "2.8",
    titulo: "Avisos y rachas",
    items: [
      { e: "⏰", t: "Avisos antes", x: "Recordatorios y eventos te avisan a la hora o hasta 2 horas antes." },
      { e: "🔥", t: "Hábitos con hora y para presumir", x: "Tu hábito te pregunta “¿ya lo hiciste?” a su hora, y tu racha se comparte como story." },
      { e: "💸", t: "Anota pagos como lo dirías", x: "“Pagar la renta el 5 de cada mes $6,500” y listo.", pro: true },
    ],
  },
  {
    version: "2.6",
    titulo: "Escríbelo como lo dirías",
    items: [
      { e: "✍️", t: "Anotar rápido", x: "“Cena con Ana el viernes 9pm en La Chaya”: se arma solo y tú revisas." },
      { e: "🗓️", t: "Tu semana", x: "Cada domingo, lo que viene: entregas, pagos, cumpleaños y viajes.", pro: true },
    ],
  },
  {
    version: "2.5",
    titulo: "Viajes y pagos",
    items: [
      { e: "✈️", t: "Viajes completos", x: "Itinerario por día, maleta con palomitas, reservas y gastos.", pro: true },
      { e: "💳", t: "Pagos fijos", x: "Renta, tarjeta, Netflix: te avisa antes y palomeas “Ya pagué”.", pro: true },
    ],
  },
  {
    version: "2.4",
    titulo: "Pendientes y hábitos",
    items: [
      { e: "☑️", t: "Pendientes", x: "Por hacer y “algún día”, con subtareas." },
      { e: "🔥", t: "Hábitos con racha", x: "Palomea cada día y ve crecer tu racha. Todos los que quieras." },
      { e: "🎂", t: "Cada año", x: "Cumpleaños y aniversarios, con aviso en Hoy unos días antes." },
    ],
  },
];
export const ULTIMA_MI = NOVEDADES_MI[0].version;

/** Lo que no ha visto (si nunca vio nada: sólo la última). */
export function novedadesSinVer(vista: string | undefined) {
  if (!vista) return NOVEDADES_MI.slice(0, 1);
  const n = (v: string) => v.split(".").map(Number).reduce((a, b) => a * 100 + b, 0);
  return NOVEDADES_MI.filter((x) => n(x.version) > n(vista));
}
