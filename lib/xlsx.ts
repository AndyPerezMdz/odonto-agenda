// 3.0 · Un .xlsx de verdad, sin librerías: un zip "guardado" (sin comprimir) con el XML mínimo de Excel.
// Una hoja por tabla, encabezado en negritas y fijo, columnas con ancho según su contenido.

export type Hoja = { nombre: string; columnas: string[]; filas: (string | number | null | undefined)[][] };

const enc = new TextEncoder();
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

/** Columna de Excel: 0 → A, 26 → AA. */
export const letra = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letra(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

/** Nombre de hoja válido para Excel (31 letras, sin []:*?/\) y sin repetir. */
function nombresHojas(hojas: Hoja[]) {
  const vistos = new Set<string>();
  return hojas.map((h) => {
    let n = h.nombre.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Hoja";
    for (let k = 2; vistos.has(n.toLowerCase()); k++) n = `${n.slice(0, 28)} ${k}`;
    vistos.add(n.toLowerCase());
    return n;
  });
}

function hojaXml(h: Hoja) {
  const anchos = h.columnas.map((c, i) => Math.min(60, Math.max(8, c.length + 2, ...h.filas.slice(0, 500).map((f) => String(f[i] ?? "").length + 1))));
  const celda = (v: Hoja["filas"][number][number], ref: string, estilo = 0) => {
    if (v == null || v === "") return "";
    const s = estilo ? ` s="${estilo}"` : "";
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
  };
  const filas = [h.columnas, ...h.filas]
    .map((f, r) => `<row r="${r + 1}">${f.map((v, c) => celda(v, `${letra(c)}${r + 1}`, r === 0 ? 1 : 0)).join("")}</row>`)
    .join("");
  const fin = `${letra(Math.max(0, h.columnas.length - 1))}${h.filas.length + 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${filas}</sheetData>${h.filas.length ? `<autoFilter ref="A1:${fin}"/>` : ""}
</worksheet>`;
}

/* ---------- zip sin comprimir ---------- */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zip(archivos: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let off = 0;
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const crc = crc32(a.datos);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true);
    loc.setUint16(4, 20, true);
    loc.setUint16(6, 0x0800, true); // nombres en UTF-8
    loc.setUint16(8, 0, true); // sin comprimir
    loc.setUint16(12, 33, true); // fecha: 1 ene 1980 (algunos programas no aceptan 0)
    loc.setUint32(14, crc, true);
    loc.setUint32(18, a.datos.length, true);
    loc.setUint32(22, a.datos.length, true);
    loc.setUint16(26, nombre.length, true);
    partes.push(new Uint8Array(loc.buffer), nombre, a.datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(14, 33, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, a.datos.length, true);
    cen.setUint32(24, a.datos.length, true);
    cen.setUint16(28, nombre.length, true);
    cen.setUint32(42, off, true);
    central.push(new Uint8Array(cen.buffer), nombre);
    off += 30 + nombre.length + a.datos.length;
  }
  const tamCentral = central.reduce((n, x) => n + x.length, 0);
  const finCd = new DataView(new ArrayBuffer(22));
  finCd.setUint32(0, 0x06054b50, true);
  finCd.setUint16(8, archivos.length, true);
  finCd.setUint16(10, archivos.length, true);
  finCd.setUint32(12, tamCentral, true);
  finCd.setUint32(16, off, true);
  const todo = [...partes, ...central, new Uint8Array(finCd.buffer)];
  const out = new Uint8Array(todo.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of todo) { out.set(x, i); i += x.length; }
  return out;
}

/** El libro de Excel completo. */
export function libroXlsx(hojas: Hoja[]): Uint8Array {
  const nombres = nombresHojas(hojas);
  const a = (nombre: string, s: string) => ({ nombre, datos: enc.encode(s) });
  return zip([
    a("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`),
    a("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    a("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nombres.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    a("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    a("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFB4472E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
    ...hojas.map((h, i) => a(`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h))),
  ]);
}
