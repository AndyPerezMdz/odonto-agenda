// Service worker de La agendita.
// 1) Notificaciones (push) y abrir la agenda al tocarlas.
// 2) 3.4 · Sin conexión: guarda lo último que viste (páginas y datos) para abrirla sin internet,
//    y lo que anotes sin señal se queda en una cola que se sube sola cuando vuelve el internet.
const VERSION = "3.4.0";
const ESTATICO = `estatico-${VERSION}`;
const PAGINAS = "paginas";
const DATOS = "datos";
const ESPERA_RED = 6000; // si la red tarda más que esto, enseña lo guardado

// Tablas con id uuid generado por la base: si se crean sin conexión les ponemos el id aquí,
// así se pueden editar/borrar antes de subirse y al subirse quedan con el mismo id.
const CON_ID = new Set(["citas", "pacientes", "horarios", "material", "clinicas", "materias", "p_eventos", "p_pendientes", "p_habitos", "p_viaje_cosas", "p_pagos_fijos", "p_categorias"]);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGINAS).then((c) => c.add(new Request("/offline.html", { cache: "reload" }))).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("estatico-") && k !== ESTATICO).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

/* ───────────── Notificaciones ───────────── */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "La agendita", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(
    self.registration.showNotification(d.title || "La agendita", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.tag || undefined,
      data: { url: d.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ("focus" in v) { v.navigate(url); return v.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});

/* ───────────── Sin conexión: lectura ───────────── */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  let url;
  try { url = new URL(req.url); } catch { return; }

  if (url.origin === self.location.origin) {
    if (req.method !== "GET") return;
    const p = url.pathname;
    if (p.startsWith("/_next/static/") || /\.(?:png|svg|ico|woff2?|webmanifest)$/.test(p)) return e.respondWith(primeroCache(req));
    if (p === "/sw.js" || p.startsWith("/auth/") || p.startsWith("/api/push") || p.startsWith("/api/cal") || p.startsWith("/api/recordatorios") || p.startsWith("/api/mp") || p.startsWith("/_next/")) return;
    if (req.mode === "navigate") return e.respondWith(pagina(req));
    if (p.startsWith("/api/") || req.headers.get("RSC")) return e.respondWith(primeroRed(req));
    return;
  }

  // Datos de Supabase (la API REST; no auth, no realtime, no funciones)
  if (url.pathname.includes("/rest/v1/") && !url.pathname.includes("/rest/v1/rpc/")) {
    if (req.method === "GET") return e.respondWith(primeroRed(req, claveDatos(req)));
    if (["POST", "PATCH", "DELETE"].includes(req.method)) return e.respondWith(mutacion(req));
  }
});

function conTiempo(promesa, ms) {
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error("tiempo")), ms);
    promesa.then((r) => { clearTimeout(t); ok(r); }, (err) => { clearTimeout(t); mal(err); });
  });
}

async function primeroCache(req) {
  const cache = await caches.open(ESTATICO);
  const hay = await cache.match(req);
  if (hay) return hay;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

// Páginas: de internet si contesta rápido (y se guarda); si no, la última que se vio.
async function pagina(req) {
  const url = new URL(req.url);
  const clave = url.origin + url.pathname;
  const cache = await caches.open(PAGINAS);
  const red = fetch(req).then((res) => {
    if (res.ok && !res.redirected && res.type === "basic" && !url.pathname.startsWith("/login")) cache.put(clave, res.clone()).catch(() => {});
    return res;
  });
  red.catch(() => {});
  try {
    return await conTiempo(red, ESPERA_RED);
  } catch {
    const guardada = await cache.match(clave, { ignoreVary: true });
    if (guardada) return guardada;
    try { return await red; } catch {
      return (await cache.match("/offline.html")) || new Response("Sin conexión", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  }
}

// Supabase pide igual una lista o "un solo renglón" (Accept distinto): se guardan aparte.
function claveDatos(req) {
  const obj = (req.headers.get("accept") || "").includes("vnd.pgrst.object");
  const u = new URL(req.url);
  if (obj) u.searchParams.set("__sw", "obj");
  return u.toString();
}

async function primeroRed(req, clave) {
  const cache = await caches.open(DATOS);
  const k = clave || req.url;
  const red = fetch(req).then((res) => {
    if (res.ok) cache.put(k, res.clone()).catch(() => {});
    return res;
  });
  red.catch(() => {});
  try {
    return await conTiempo(red, ESPERA_RED);
  } catch (err) {
    const guardada = await cache.match(k, { ignoreVary: true });
    if (guardada) return guardada;
    return red; // sin nada guardado: que truene como siempre
  }
}

/* ───────────── Sin conexión: escritura (cola) ───────────── */
function db() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open("la-agendita-offline", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("cola", { keyPath: "id" });
      r.result.createObjectStore("meta");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function tx(store, modo, fn) {
  const d = await db();
  return new Promise((ok, mal) => {
    const t = d.transaction(store, modo);
    const s = t.objectStore(store);
    let res;
    Promise.resolve(fn(s)).then((r) => { res = r; });
    t.oncomplete = () => ok(res);
    t.onerror = () => mal(t.error);
  });
}
const pedir = (r) => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });
const cola = () => tx("cola", "readonly", (s) => pedir(s.getAll()));
const usuario = () => tx("meta", "readonly", (s) => pedir(s.get("usuario")));

async function avisar(msg) {
  const vs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  vs.forEach((v) => v.postMessage(msg));
}
async function cuantos() {
  const u = await usuario().catch(() => null);
  return (await cola().catch(() => [])).filter((x) => !u || x.u === u).length;
}

async function mutacion(req) {
  const copia = req.clone();
  try {
    return await fetch(req);
  } catch {
    // Sin red: a la cola, y lo que ya tenemos guardado se actualiza para que se vea al instante
    const url = new URL(copia.url);
    const tabla = decodeURIComponent(url.pathname.split("/rest/v1/")[1] || "");
    let texto = copia.method === "DELETE" ? "" : await copia.text();
    let datos = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch {}
    if (copia.method === "POST" && datos && CON_ID.has(tabla) && !url.searchParams.has("on_conflict")) {
      const filas = Array.isArray(datos) ? datos : [datos];
      filas.forEach((f) => { if (f && typeof f === "object" && !f.id) f.id = crypto.randomUUID(); });
      texto = JSON.stringify(datos);
    }
    const headers = {};
    for (const [k, v] of copia.headers) if (["content-type", "prefer", "accept", "content-profile", "accept-profile"].includes(k)) headers[k] = v;
    const u = await usuario().catch(() => null);
    await tx("cola", "readwrite", (s) => s.put({ id: crypto.randomUUID(), t: Date.now(), u, url: copia.url, metodo: copia.method, headers, cuerpo: texto, tabla }));
    const filas = await reflejar(tabla, copia.method, url, datos).catch(() => []);
    avisar({ tipo: "cola", n: await cuantos() });

    const prefer = copia.headers.get("prefer") || "";
    const obj = (copia.headers.get("accept") || "").includes("vnd.pgrst.object");
    if (!prefer.includes("return=representation")) return new Response(null, { status: copia.method === "POST" ? 201 : 204 });
    const cuerpo = obj ? JSON.stringify(filas[0] ?? {}) : JSON.stringify(filas);
    return new Response(cuerpo, { status: copia.method === "POST" ? 201 : 200, headers: { "content-type": "application/json" } });
  }
}

// Filtros sencillos de PostgREST (col=eq.x, gte, lte, gt, lt, neq, is, in) contra un renglón.
function cumple(fila, params, sinFiltroEsNo) {
  let hubo = false;
  for (const [col, v] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns", "__sw", "or", "and"].includes(col)) continue;
    const i = v.indexOf(".");
    if (i < 0) continue;
    const op = v.slice(0, i), val = v.slice(i + 1);
    if (!(col in fila)) continue;
    const x = fila[col];
    const s = x == null ? null : String(x);
    hubo = true;
    if (op === "eq" && s !== val) return false;
    if (op === "neq" && s === val) return false;
    if (op === "is" && !((val === "null" && x == null) || (val === "true" && x === true) || (val === "false" && x === false))) return false;
    if (op === "in" && !val.replace(/^\(|\)$/g, "").split(",").map((z) => z.replace(/^"|"$/g, "")).includes(s)) return false;
    if (["gte", "lte", "gt", "lt"].includes(op) && s != null) {
      if (op === "gte" && !(s >= val)) return false;
      if (op === "lte" && !(s <= val)) return false;
      if (op === "gt" && !(s > val)) return false;
      if (op === "lt" && !(s < val)) return false;
    }
  }
  return sinFiltroEsNo ? hubo : true;
}

async function reflejar(tabla, metodo, url, datos) {
  const cache = await caches.open(DATOS);
  const llaves = (await cache.keys()).filter((k) => {
    const u = new URL(k.url);
    return decodeURIComponent(u.pathname.split("/rest/v1/")[1] || "") === tabla && !u.searchParams.has("__sw");
  });
  const nuevas = metodo === "POST" ? (Array.isArray(datos) ? datos : [datos]).filter(Boolean) : [];
  const conflicto = (url.searchParams.get("on_conflict") || "").split(",").filter(Boolean);
  let tocadas = [];
  for (const k of llaves) {
    const res = await cache.match(k);
    if (!res) continue;
    let lista;
    try { lista = await res.clone().json(); } catch { continue; }
    if (!Array.isArray(lista)) continue;
    const gp = new URL(k.url).searchParams;
    if (metodo === "POST") {
      for (const f of nuevas) {
        const ya = conflicto.length ? lista.findIndex((r) => conflicto.every((c) => String(r[c]) === String(f[c]))) : f.id ? lista.findIndex((r) => r.id === f.id) : -1;
        if (ya >= 0) Object.assign(lista[ya], f);
        else if (cumple(f, gp, false)) lista.push({ ...f });
      }
      tocadas = nuevas;
    } else if (metodo === "PATCH") {
      lista.forEach((r) => { if (cumple(r, url.searchParams, true)) { Object.assign(r, datos || {}); tocadas.push(r); } });
    } else if (metodo === "DELETE") {
      lista = lista.filter((r) => !cumple(r, url.searchParams, true));
    }
    await cache.put(k, new Response(JSON.stringify(lista), { headers: res.headers }));
  }
  if (metodo === "PATCH" && !tocadas.length && datos) tocadas = [datos];
  return tocadas;
}

let subiendo = false;
async function sincronizar(token, apikey) {
  if (subiendo) return;
  subiendo = true;
  let subidos = 0;
  const fallidos = [];
  try {
    const u = await usuario().catch(() => null);
    const lista = (await cola()).filter((x) => !u || !x.u || x.u === u).sort((a, b) => a.t - b.t);
    for (const it of lista) {
      let res;
      try {
        res = await fetch(it.url, { method: it.metodo, headers: { ...it.headers, prefer: (it.headers.prefer || "").replace("return=representation", "return=minimal") || "return=minimal", authorization: `Bearer ${token}`, apikey }, body: it.cuerpo || undefined });
      } catch {
        break; // se volvió a ir la señal
      }
      if (res.status === 401 || res.status >= 500) break; // sesión o servidor: se reintenta luego
      let quitar = res.ok;
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.code === "23505" && it.metodo === "POST") quitar = true; // ya se había subido
        else {
          quitar = true;
          fallidos.push({ tabla: it.tabla, mensaje: j.code === "23P01" ? "Se encimaba con otra cita que alguien agendó mientras no tenías señal." : j.message || `Error ${res.status}` });
        }
      }
      if (quitar) {
        await tx("cola", "readwrite", (s) => s.delete(it.id));
        if (res.ok) subidos++;
      }
    }
  } finally {
    subiendo = false;
  }
  avisar({ tipo: "sincronizado", subidos, fallidos, quedan: await cuantos() });
}

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.tipo === "usuario" && d.id) {
    e.waitUntil(
      (async () => {
        const antes = await usuario().catch(() => null);
        await tx("meta", "readwrite", (s) => s.put(d.id, "usuario"));
        // Otra cuenta en el mismo cel: no le enseñamos lo guardado de la anterior
        if (antes && antes !== d.id) await Promise.all([caches.delete(DATOS), caches.delete(PAGINAS)]);
      })()
    );
  }
  if (d.tipo === "salir") e.waitUntil(Promise.all([caches.delete(DATOS), caches.delete(PAGINAS)]));
  if (d.tipo === "sincronizar" && d.token) e.waitUntil(sincronizar(d.token, d.apikey));
  if (d.tipo === "estado") e.waitUntil(cuantos().then((n) => e.source && e.source.postMessage({ tipo: "cola", n })));
});
