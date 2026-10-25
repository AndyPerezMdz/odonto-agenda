import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";
import { fuentePapel } from "@/lib/fuentePapel";
import { metaMiAgenda, viewportMiAgenda } from "@/lib/metaMiAgenda";

type Props = { searchParams: Promise<{ a?: string }> };

// 2.3 · Un solo login, con dos caras: la de clínicas y la de Mi agenda (/login?a=mi).
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { a } = await searchParams;
  return a === "mi" ? { ...metaMiAgenda, title: { absolute: "Entra a Mi agenda" } } : { title: "Entrar · La agendita" };
}

export async function generateViewport({ searchParams }: Props) {
  const { a } = await searchParams;
  return a === "mi" ? viewportMiAgenda : {};
}

export default async function LoginPage({ searchParams }: Props) {
  const { a } = await searchParams;
  if (a === "mi") {
    return (
      <div className={`mi-agenda ${fuentePapel.variable}`}>
        <LoginForm mi />
      </div>
    );
  }
  return <LoginForm />;
}
