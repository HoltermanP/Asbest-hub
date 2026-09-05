import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="font-heading text-2xl font-semibold">Pagina niet gevonden</h1>
      <Link href="/projecten" className="text-ai-blue hover:underline">
        Naar projecten
      </Link>
    </div>
  );
}
