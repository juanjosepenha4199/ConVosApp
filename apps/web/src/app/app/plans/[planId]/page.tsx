'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fetchMeWithRefresh, getAccessToken } from '@/lib/auth';

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function PlanDetailPage() {
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const planId = params.planId;

  const [plan, setPlan] = useState<Awaited<ReturnType<typeof api.plans.get>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await fetchMeWithRefresh();
      if (!me) {
        router.replace('/auth/login');
        return;
      }
      const token = getAccessToken();
      if (!token) return;
      try {
        const p = await api.plans.get(token, planId);
        setPlan(p);
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Plan no encontrado';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [planId, router]);

  async function cancelPlan() {
    if (!plan || plan.status !== 'scheduled') return;
    const token = getAccessToken();
    if (!token) return;
    if (!window.confirm('¿Cancelar este plan?')) return;
    setCancelling(true);
    setError(null);
    try {
      await api.plans.cancel(token, planId);
      const p = await api.plans.get(token, planId);
      setPlan(p);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo cancelar';
      setError(msg);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-6">
      <header>
        <Link href={plan ? `/app/groups/${plan.groupId}` : '/app'} className="text-sm font-medium text-violet-600/90 hover:underline">
          ← Volver al grupo
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800">{loading ? '…' : plan?.title ?? 'Plan'}</h1>
      </header>

      {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {plan ? (
        <div className="convos-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">{formatWhen(plan.scheduledAt)}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{plan.place?.name}</p>
              <p className="text-sm text-slate-600">{plan.place?.address}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                plan.status === 'scheduled' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {plan.status}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {plan.status === 'scheduled' ? (
              <Link href={`/app/plans/${plan.id}/validate`} className="convos-btn-primary h-12 flex-1 text-center text-base leading-[2.75rem]">
                Validar plan (foto + GPS)
              </Link>
            ) : (
              <p className="text-sm text-slate-600">Este plan ya no admite validación.</p>
            )}
            {plan.status === 'scheduled' ? (
              <button
                type="button"
                className="convos-btn-ghost h-12 px-6 text-sm text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                disabled={cancelling}
                onClick={() => void cancelPlan()}
              >
                {cancelling ? '…' : 'Cancelar plan'}
              </button>
            ) : null}
          </div>
        </div>
      ) : !loading ? (
        <p className="text-sm text-slate-600">No se encontró el plan.</p>
      ) : null}
    </div>
  );
}
