export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-1/2 flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="font-heading text-2xl font-semibold">AsbestHub</div>
        <div className="max-w-md space-y-4">
          <h1 className="font-heading text-4xl font-semibold leading-tight">Asbestsanering van aanbesteding tot oplevering.</h1>
          <p className="text-white/70">
            Projecten, meldingen, aanbestedingsstukken en beoordelingen op één plek. AI stelt voor, u accordeert.
          </p>
        </div>
        <div className="font-mono text-xs text-white/50">Human-in-the-loop by design</div>
      </aside>
      <main className="flex flex-1 items-center justify-center p-6">{children}</main>
    </div>
  );
}
