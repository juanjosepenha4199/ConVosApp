'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { absoluteUrlForApiPath, api } from '@/lib/api';
import { fetchMeWithRefresh, getAccessToken } from '@/lib/auth';

type Step = 'permissions' | 'captured' | 'uploading' | 'submitting' | 'done';

export default function ValidatePlanPage() {
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const planId = params.planId;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>('permissions');
  const [error, setError] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [result, setResult] = useState<unknown | null>(null);
  /** React no re-renderiza al asignar refs: sin esto, «Tomar foto» queda deshabilitado para siempre. */
  const [cameraReady, setCameraReady] = useState(false);

  const canCamera = useMemo(() => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia, []);

  useEffect(() => {
    (async () => {
      const me = await fetchMeWithRefresh();
      if (!me) router.replace('/auth/login');
    })();
  }, [router]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestCamera() {
    setError(null);
    setCameraReady(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
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

  async function requestGeo() {
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      setGeo({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    } catch {
      setError('No se pudo obtener tu ubicación. Activa GPS/permisos e inténtalo de nuevo.');
    }
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

    setPhotoBlob(blob);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setStep('captured');
  }

  async function onValidate() {
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error('No session');
      if (!photoBlob) throw new Error('No photo');
      if (!geo) throw new Error('No geo');

      setStep('uploading');
      const init = await api.validation.init(token, planId);

      const fd = new FormData();
      fd.append('file', photoBlob, 'capture.jpg');
      const upRes = await fetch(absoluteUrlForApiPath(init.uploadUrl), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!upRes.ok) throw new Error(await upRes.text());

      setStep('submitting');
      const out = await api.validation.submit(token, planId, {
        photoId: init.photoId,
        capturedAtClient: new Date().toISOString(),
        lat: geo.lat,
        lng: geo.lng,
        gpsAccuracyM: geo.accuracy,
        deviceInfo: { ua: navigator.userAgent },
      });
      setResult(out);
      setStep('done');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'No se pudo validar';
      setError(msg);
      setStep('captured');
    }
  }

  return (
    <div className="convos-gradient mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-violet-600">Validación</div>
          <div className="text-2xl font-bold tracking-tight text-slate-800">Validar plan</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/profile"
            className="rounded-full px-4 py-2 text-sm font-semibold text-violet-800 transition-all hover:bg-white/80 hover:shadow-md"
          >
            Mi perfil
          </Link>
          <button
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-white/80 hover:shadow-md"
            onClick={() => router.back()}
          >
            Volver
          </button>
        </div>
      </header>

      <div className="convos-card p-6">
        <div className="grid gap-3 md:grid-cols-2 md:items-start">
          <div className="grid gap-3">
            <div className="text-sm font-bold text-slate-800">1) Cámara</div>
            {canCamera ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-video w-full rounded-2xl bg-slate-100 object-cover ring-2 ring-violet-100"
                />
                <div className="flex gap-2">
                  <button
                    className="convos-btn-primary h-11 flex-1 text-sm"
                    onClick={requestCamera}
                  >
                    Activar cámara
                  </button>
                  <button
                    className="convos-btn-ghost h-11 flex-1 text-sm"
                    onClick={() => void capture()}
                    disabled={!cameraReady}
                  >
                    Tomar foto
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-600">
                Tu navegador no soporta cámara directa. Usa un móvil o un navegador compatible.
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <div className="text-sm font-bold text-slate-800">2) Ubicación</div>
            <button
              className="convos-btn-ghost h-11 w-full text-sm"
              onClick={requestGeo}
            >
              Capturar GPS
            </button>
            <div className="text-sm text-slate-600">
              {geo ? (
                <>
                  lat {geo.lat.toFixed(5)} · lng {geo.lng.toFixed(5)} · ±{Math.round(geo.accuracy ?? 0)}m
                </>
              ) : (
                'Aún no capturado'
              )}
            </div>

            <div className="pt-2 text-sm font-bold text-slate-800">3) Enviar</div>
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="preview"
                width={1280}
                height={720}
                unoptimized
                className="aspect-video w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-violet-50 to-cyan-50 ring-1 ring-violet-100" />
            )}
            <button
              className="convos-btn-primary h-12 w-full text-sm disabled:opacity-60"
              disabled={!photoBlob || !geo || step === 'uploading' || step === 'submitting'}
              onClick={onValidate}
            >
              {step === 'uploading'
                ? 'Subiendo foto…'
                : step === 'submitting'
                  ? 'Validando…'
                  : 'Validar ahora'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/90 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/90 p-3 text-sm font-medium text-emerald-800">
            Validación {String((result as { status?: unknown })?.status ?? 'ok')}.
          </div>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

