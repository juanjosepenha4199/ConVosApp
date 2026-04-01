import Link from 'next/link';
import { ConvosJoy, ConvosPartyGif } from '@/components/ConvosJoy';

export default function Home() {
  return (
    <div className="convos-gradient flex min-h-[calc(100vh-0px)] flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" className="group flex items-center gap-3 transition-transform hover:scale-[1.02]">
          <div className="convos-brand h-10 w-10 rounded-2xl shadow-lg ring-4 ring-white/60" />
          <span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-cyan-600 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            ConVos
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-violet-800/90 transition-all hover:bg-white/80 hover:shadow-md"
          >
            Iniciar sesión
          </Link>
          <Link href="/auth/register" className="convos-btn-primary px-5 py-2.5 text-sm">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-5 pb-20 pt-8">
        <section className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="flex flex-col gap-6">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-600 shadow-sm ring-1 ring-violet-100">
              Intención → acción → recuerdo
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-800 md:text-5xl">
              Planes que{' '}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
                sí pasan
              </span>
              . Con prueba real.
            </h1>
            <p className="text-lg leading-relaxed text-slate-600">
              Grupos, citas en el mapa, validación con foto + GPS y una timeline solo para ustedes. Puntos y rachas para
              que salir sea un hábito.
            </p>
            <ConvosJoy className="justify-start py-1" size="lg" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/auth/register" className="convos-btn-primary h-12 px-8 text-base">
                Empezar gratis
              </Link>
              <Link href="/app" className="convos-btn-ghost h-12 px-8 text-base">
                Ver dashboard
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { t: 'Validación', d: 'Foto + GPS + hora', emoji: '📸' },
                { t: 'Puntos', d: 'Rachas y niveles', emoji: '✨' },
                { t: 'Timeline', d: 'Memorias privadas', emoji: '💜' },
              ].map((s) => (
                <div
                  key={s.t}
                  className="convos-card group cursor-default p-4 text-center sm:text-left"
                >
                  <div className="mb-1 text-2xl transition-transform duration-300 group-hover:scale-110">{s.emoji}</div>
                  <div className="font-semibold text-slate-800">{s.t}</div>
                  <div className="text-sm text-slate-500">{s.d}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="convos-float convos-card relative overflow-hidden p-6">
            <div className="absolute right-3 top-3 hidden opacity-90 sm:block">
              <ConvosPartyGif className="w-[100px]" />
            </div>
            <div className="flex items-center justify-between sm:pr-28">
              <div className="text-sm font-bold text-slate-800">Tu semana</div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                +120 pts
              </span>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-cyan-50 p-4 ring-1 ring-violet-100">
                <div className="text-sm font-semibold text-slate-800">Misión semanal</div>
                <div className="mt-1 text-sm text-slate-600">Salir 3 veces esta semana</div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/80">
                  <div
                    className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 transition-all duration-700"
                    style={{ width: '66%' }}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-white/90 p-4 ring-1 ring-slate-100">
                <div className="text-sm font-semibold text-slate-800">Próximo plan</div>
                <div className="mt-1 text-sm text-slate-600">Cena · Hoy 20:30 · a 250 m</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                    Cámara
                  </span>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                    +100 pts
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-10 text-sm text-slate-500">
        © {new Date().getFullYear()} ConVos · Privado por defecto
      </footer>
    </div>
  );
}
