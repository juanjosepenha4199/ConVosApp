import Link from 'next/link';
import { ConvosJoy, ConvosPartyGif } from '@/components/ConvosJoy';

const BENTO = [
  {
    k: 'v',
    title: 'Validación real',
    desc: 'Foto en el momento + comprobación de hora. Nada de humo.',
    emoji: '📸',
    span: 'md:col-span-4',
  },
  {
    k: 'p',
    title: 'Puntos y rachas',
    desc: 'Arena por tipo de grupo y ligas. Salir de casa suma.',
    emoji: '✨',
    span: 'md:col-span-4',
  },
  {
    k: 't',
    title: 'Solo vosotros',
    desc: 'Timeline y fotos del grupo privadas por diseño.',
    emoji: '🔐',
    span: 'md:col-span-4',
  },
];

export default function Home() {
  return (
    <div className="convos-gradient relative flex min-h-screen flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(255,46,46,0.25), transparent 55%)',
        }}
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pb-2 pt-8 sm:px-6">
        <nav className="convos-nav-pill">
          <Link href="/" className="group flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4">
            <div className="convos-brand h-9 w-9 rounded-xl shadow-[0_0_20px_rgba(255,46,46,0.45)] ring-2 ring-red-500/30" />
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">ConVos</span>
          </Link>
          <span className="mx-1 hidden h-5 w-px bg-slate-300 dark:bg-white/15 sm:block" aria-hidden />
          <div className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1">
            <Link
              href="/auth/login"
              className="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-white sm:text-sm"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/auth/register"
              className="convos-btn-primary px-5 py-2 text-xs sm:text-sm"
            >
              Crear cuenta
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 pb-24 pt-4 sm:px-6">
        <section className="grid gap-5 md:grid-cols-12 md:gap-5">
          <div className="convos-bento flex flex-col justify-between p-8 md:col-span-7 md:min-h-[320px] md:p-10">
            <div>
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-red-700 dark:text-red-300">
                Intención → acción → recuerdo
              </p>
              <h1 className="mt-8 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 dark:text-white md:text-5xl lg:text-[3.25rem]">
                Planes que{' '}
                <span className="text-[#ff3b3b] drop-shadow-[0_0_32px_rgba(255,59,59,0.55)]">
                  sí pasan
                </span>
                . Con prueba real.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 dark:text-zinc-400 md:text-lg">
                Grupos, citas concretas, validación con foto y una línea de tiempo solo para ustedes.
                Gamificación ligera para que salir no quede en el aire.
              </p>
            </div>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="/auth/register" className="convos-btn-primary h-14 px-10 text-base font-semibold">
                Empezar gratis
              </Link>
              <Link
                href="/app"
                className="convos-btn-ghost h-14 px-10 text-center text-base font-semibold"
              >
                Ver dashboard
              </Link>
            </div>
          </div>

          <div className="convos-bento convos-float relative flex flex-col overflow-hidden p-6 md:col-span-5 md:p-8">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/20 blur-3xl" aria-hidden />
            <div className="absolute right-4 top-4 z-10 hidden sm:block">
              <ConvosPartyGif className="w-[108px]" />
            </div>
            <div className="relative flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Vista previa</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                +120 pts
              </span>
            </div>
            <div className="relative mt-8 grid flex-1 gap-4">
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-100/80 dark:bg-black/30 p-4 ring-1 ring-red-500/10">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Misión semanal</div>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">Tres salidas esta semana</p>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_16px_rgba(255,60,60,0.6)]"
                    style={{ width: '66%' }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-black/25 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Próximo plan</div>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">Cena · Hoy 20:30</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                    Foto
                  </span>
                  <span className="rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    +100 pts
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Todo en un solo flujo
              </h2>
              <p className="mt-2 max-w-lg text-sm text-slate-500 dark:text-zinc-500 md:text-base">
                Bloques claros, como una app de producto — sin ruido visual.
              </p>
            </div>
            <ConvosJoy className="justify-end opacity-90" size="md" />
          </div>
          <div className="grid gap-4 md:grid-cols-12">
            {BENTO.map((b) => (
              <div key={b.k} className={`convos-bento p-7 ${b.span}`}>
                <div className="text-3xl">{b.emoji}</div>
                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-zinc-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="convos-bento px-8 py-12 text-center md:px-16 md:py-16">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white md:text-3xl">
            ¿Listos para el <span className="text-[#ff3b3b]">siguiente plan</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-slate-500 dark:text-zinc-500 md:text-base">
            Creáis el grupo en segundos. El resto es conversación — y una foto cuando toque.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/auth/register" className="convos-btn-primary h-14 px-12 text-base">
              Crear cuenta
            </Link>
            <Link href="/auth/login" className="convos-btn-ghost h-14 px-12 text-base">
              Ya tengo cuenta
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 text-center text-xs text-slate-500 dark:text-zinc-500 sm:px-6 sm:text-sm">
        © {new Date().getFullYear()} ConVos · Privado por defecto
      </footer>
    </div>
  );
}
