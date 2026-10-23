// 2.8 · "Presumir racha": arma una imagen tipo story (1080×1920) y la comparte (o la descarga si el cel no deja).

export async function presumirRacha({ nombre, racha, mejor, color }: { nombre: string; racha: number; mejor: number; color: string }) {
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return "error" as const;

  // La letra de la agenda (la de los títulos)
  const ref = document.querySelector(".serif");
  const serif = (ref && getComputedStyle(ref).fontFamily) || "Georgia, serif";
  const sans = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  try {
    await document.fonts?.ready;
  } catch {}

  // Papel con puntitos
  g.fillStyle = "#f3ede2";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(120, 100, 70, 0.13)";
  for (let y = 30; y < H; y += 44) for (let x = 30; x < W; x += 44) g.fillRect(x, y, 4, 4);

  // Tarjeta
  const x0 = 90, y0 = 380, w = W - 180, h = 1060, r = 56;
  g.save();
  g.shadowColor = "rgba(60,45,10,0.18)";
  g.shadowBlur = 60;
  g.shadowOffsetY = 24;
  g.fillStyle = "#fbf8f2";
  g.beginPath();
  g.roundRect(x0, y0, w, h, r);
  g.fill();
  g.restore();
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x0, y0, w, 26, [r, r, 0, 0]);
  g.fill();

  g.textAlign = "center";
  g.fillStyle = "#2b2520";
  g.font = `600 44px ${sans}`;
  g.fillText("LLEVO", W / 2, y0 + 150);

  g.font = `260px ${sans}`;
  g.fillText("🔥", W / 2, y0 + 440);

  g.fillStyle = color;
  g.font = `340px ${serif}`;
  g.fillText(String(racha), W / 2, y0 + 790);

  g.fillStyle = "#2b2520";
  g.font = `italic 76px ${serif}`;
  g.fillText(racha === 1 ? "día seguido de" : "días seguidos de", W / 2, y0 + 900);

  // Nombre del hábito (se achica si es largo)
  let tam = 92;
  g.font = `${tam}px ${serif}`;
  while (g.measureText(nombre).width > w - 120 && tam > 44) g.font = `${(tam -= 4)}px ${serif}`;
  g.fillText(nombre, W / 2, y0 + 1010);

  if (mejor > racha) {
    g.fillStyle = "#7a7166";
    g.font = `500 40px ${sans}`;
    g.fillText(`Mi mejor racha: ${mejor} días`, W / 2, y0 + h + 110);
  }

  // Marca
  g.fillStyle = "#b4472e";
  g.font = `72px ${serif}`;
  g.fillText("Mi agenda", W / 2, H - 230);
  g.fillStyle = "#7a7166";
  g.font = `500 38px ${sans}`;
  g.fillText(location.host, W / 2, H - 165);

  const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
  if (!blob) return "error" as const;
  const archivo = new File([blob], `racha-${racha}-dias.png`, { type: "image/png" });
  const texto = `Llevo ${racha} ${racha === 1 ? "día" : "días"} seguidos de ${nombre} 🔥`;
  try {
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], text: texto });
      return "compartida" as const;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return "cancelada" as const;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "descargada" as const;
}
