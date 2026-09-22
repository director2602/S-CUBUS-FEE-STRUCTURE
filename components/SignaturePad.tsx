"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type SignaturePadHandle = {
  getDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
};

const SignaturePad = forwardRef<SignaturePadHandle, {}>(function SignaturePad(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#400C4D";
    }
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  }

  function onPointerUp() {
    drawing.current = false;
  }

  useImperativeHandle(ref, () => ({
    getDataUrl: () => (hasInk.current ? canvasRef.current?.toDataURL("image/png") ?? null : null),
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasInk.current = false;
      forceRender((n) => n + 1);
    },
    isEmpty: () => !hasInk.current
  }));

  return (
    <canvas
      ref={canvasRef}
      className="sig-pad"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
});

export default SignaturePad;
