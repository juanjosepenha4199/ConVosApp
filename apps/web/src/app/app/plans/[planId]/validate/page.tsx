'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCelebration } from '@/components/CelebrationProvider';
import { absoluteUrlForApiPath, api } from '@/lib/api';
import { fetchMeWithRefresh, getAccessToken } from '@/lib/auth';

const MAX_FILES = 12;
const ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,.pdf,.heic,.heif';

type LocalItem = {
  key: string;
  file?: File;
  blob?: Blob;
  previewUrl: string;
};

type Step = 'idle' | 'uploading' | 'submitting' | 'done';

function newItemKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function ValidatePlanPage() {
  const celebrate = useCelebration();
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const planId = params.planId;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [result, setResult] = useState<unknown | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const canCamera = useMemo(() => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia, []);

  useEffect(() => {
    (async () => {
      const me = await fetchMeWithRefresh();
      if (!me) router.replace('/auth/login');
    })();
  }, [router]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function requestCamera(preferredFacing?: 'environment' | 'user') {
    const want = preferredFacing ?? facingMode;
    setError(null);
    setCameraReady(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: want } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      const el = videoRef.current;
      if (el) {
        el.srcObject = stream;
        await el.play().catch(() => undefined);
      }
      setCameraReady(true);
    } catch {
      setError('No se pudo acceder a la cámara. Revisa permisos del navegador.');
    }
  }

  function flipCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    void requestCamera(next);
  }

  async function capture() {
    setError(null);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!streamRef.current) {
      setError('Activa primero la cámara.');
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError('La cámara aún no está lista; espera un segundo y vuelve a intentar.');
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      setError('No se pudo generar la imagen. Prueba otra vez.');
      return;
    }

    if (items.length >= MAX_FILES) {
      setError(`Máximo ${MAX_FILES} archivos por validación.`);
      return;
    }
    const previewUrl = URL.createObjectURL(blob);
    setItems((prev) => [...prev, { key: newItemKey(), blob, previewUrl }]);
  }

  function onPickFiles(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const list = e.target.files;
    if (!list?.length) return;
    setItems((prev) => {
      const next = [...prev];
      for (let i = 0; i < list.length; i++) {
        if (next.length >= MAX_FILES) {
          setError(`Solo se permiten hasta ${MAX_FILES} archivos.`);
          break;
        }
        const file = list[i];
        next.push({ key: newItemKey(), file, previewUrl: URL.createObjectURL(file) });
      }
      return next;
    });
    e.target.value = '';
  }

  function removeItem(key: string) {
    setItems((prev) => {
      const item = prev.find((x) => x.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((x) => x.key !== key);
    });
  }

  async function onValidate() {
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error('No session');
      if (items.length === 0) throw new Error('Añade al menos una foto o archivo.');
      setStep('uploading');
      const photoIds: string[] = [];

      for (const item of items) {
        const init = await api.validation.init(token, planId);
        const fd = new FormData();
        const body = item.file ?? item.blob;
        if (!body) continue;
        const name =
          item.file?.name ||
          (body.type === 'image/png' ? 'capture.png' : 'capture.jpg');
        fd.append('file', body, name);
        const upRes = await fetch(absoluteUrlForApiPath(init.uploadUrl), {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!upRes.ok) throw new Error(await upRes.text());
        photoIds.push(init.photoId);
      }

      if (photoIds.length === 0) throw new Error('No se pudo preparar ningún archivo.');

      setStep('submitting');
      const out = await api.validation.submit(token, planId, {
        photoIds,
        capturedAtClient: new Date().toISOString(),
        deviceInfo: { ua: navigator.userAgent },
      });
      setResult(out);
      setStep('done');
      celebrate({
        title: '¡Validación enviada!',
        message: 'Tus archivos quedaron registrados. Si todo encaja, sumaréis puntos y racha en el grupo.',
        emoji: '📎',
        durationMs: 5000,
      });
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo validar';
      setError(msg);
      setStep('idle');
    }
  }

  const busy = step === 'uploading' || step === 'submitting';

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-x-hidden px-4 py-6 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-red-400">Validación</div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Validar plan</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/profile"
            className="rounded-full px-4 py-2 text-sm font-semibold text-red-300 transition-all hover:bg-white/90 dark:bg-white/[0.07] hover:shadow-md"
          >
            Mi perfil
          </Link>
          <button
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 dark:text-zinc-300 transition-all hover:bg-white/90 dark:bg-white/[0.07] hover:shadow-md"
            onClick={() => router.back()}
          >
            Volver
          </button>
        </div>
      </header>

      <div className="convos-card p-6">
        <div className="grid gap-6">
          <div className="grid gap-3">
            <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">1) Cámara (opcional)</div>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Puedes tomar fotos desde la cámara; cada captura se añade a la lista (hasta {MAX_FILES} archivos en total).
            </p>
            {canCamera ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-video w-full max-w-full rounded-2xl bg-slate-200 dark:bg-zinc-800 object-cover ring-2 ring-red-500/12"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    className="convos-btn-primary h-12 min-h-[48px] text-sm sm:col-span-1"
                    onClick={() => void requestCamera()}
                  >
                    Activar cámara
                  </button>
                  <button
                    type="button"
                    className="convos-btn-ghost h-12 min-h-[48px] text-sm sm:col-span-1"
                    onClick={() => flipCamera()}
                  >
                    Cambiar cámara {facingMode === 'environment' ? '(selfie)' : '(trasera)'}
                  </button>
                  <button
                    type="button"
                    className="convos-btn-primary h-12 min-h-[48px] text-sm sm:col-span-1"
                    onClick={() => void capture()}
                    disabled={!cameraReady || busy || items.length >= MAX_FILES}
                  >
                    Añadir foto
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-600 dark:text-zinc-400">
                Tu navegador no soporta cámara directa. Puedes adjuntar archivos abajo.
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">2) Adjuntar archivos</div>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Fotos o PDF desde el móvil o el ordenador. Puedes combinar con la cámara. Orden de envío: el primero es la foto principal.
            </p>
            <input ref={fileInputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={onPickFiles} />
            <button
              type="button"
              className="convos-btn-ghost h-12 min-h-[48px] w-full text-sm"
              disabled={busy || items.length >= MAX_FILES}
              onClick={() => fileInputRef.current?.click()}
            >
              Elegir archivos… ({items.length}/{MAX_FILES})
            </button>
          </div>

          <div className="grid gap-3">
            <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">3) Revisar y enviar</div>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              La hora del dispositivo debe ser razonablemente correcta (comprobación automática).
            </p>
            {items.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {items.map((item, idx) => {
                  const isPdf = item.file?.type === 'application/pdf' || item.file?.name?.toLowerCase().endsWith('.pdf');
                  return (
                    <li
                      key={item.key}
                      className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] ring-1 ring-white/5"
                    >
                      <div className="relative aspect-video bg-slate-200 dark:bg-zinc-800">
                        {isPdf ? (
                          <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center text-sm text-slate-600 dark:text-zinc-400">
                            <span className="text-2xl">📄</span>
                            <span className="line-clamp-2 font-medium">{item.file?.name ?? 'PDF'}</span>
                          </div>
                        ) : (
                          <Image
                            src={item.previewUrl}
                            alt=""
                            width={1280}
                            height={720}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2">
                        <span className="truncate text-xs text-slate-500 dark:text-zinc-500">
                          {idx === 0 ? 'Principal' : `Adjunto ${idx + 1}`}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10"
                          disabled={busy}
                          onClick={() => removeItem(item.key)}
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-red-950/50 to-zinc-900 ring-1 ring-red-500/12" />
            )}
            <button
              type="button"
              className="convos-btn-primary h-12 min-h-[48px] w-full text-sm disabled:opacity-60"
              disabled={items.length === 0 || busy}
              onClick={() => void onValidate()}
            >
              {step === 'uploading' ? 'Subiendo archivos…' : step === 'submitting' ? 'Validando…' : 'Enviar validación'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-200">
            Validación {String((result as { status?: unknown })?.status ?? 'ok')}.
          </div>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
