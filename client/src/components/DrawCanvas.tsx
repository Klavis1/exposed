import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { useT } from "../i18n/LocaleContext";

const WIDTH = 520;
const HEIGHT = 390;
const JPEG_QUALITY = 0.7;

type Point = { x: number; y: number };
type Stroke = Point[];

export interface DrawCanvasHandle {
  toJpeg: () => string | null;
  isEmpty: () => boolean;
}

interface Props {
  className?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export const DrawCanvas = forwardRef<DrawCanvasHandle, Props>(
  function DrawCanvas({ className = "", onDirtyChange }, ref) {
    const t = useT();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const currentRef = useRef<Stroke | null>(null);
    const [strokeCount, setStrokeCount] = useState(0);

    const paint = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1a1520";
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const all = currentRef.current
        ? [...strokesRef.current, currentRef.current]
        : strokesRef.current;
      for (const stroke of all) {
        if (stroke.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        if (stroke.length === 1) {
          ctx.lineTo(stroke[0].x + 0.1, stroke[0].y);
        }
        ctx.stroke();
      }
    }, []);

    useEffect(() => {
      paint();
    }, [paint]);

    useEffect(() => {
      onDirtyChange?.(strokeCount > 0);
    }, [strokeCount, onDirtyChange]);

    useImperativeHandle(
      ref,
      () => ({
        toJpeg: () => {
          const canvas = canvasRef.current;
          if (!canvas || strokesRef.current.length === 0) return null;
          paint();
          return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        },
        isEmpty: () => strokesRef.current.length === 0,
      }),
      [paint]
    );

    const toLocal = (e: PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      currentRef.current = [toLocal(e)];
      paint();
    };

    const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
      if (!currentRef.current) return;
      e.preventDefault();
      currentRef.current.push(toLocal(e));
      paint();
    };

    const endStroke = (e: PointerEvent<HTMLCanvasElement>) => {
      if (!currentRef.current) return;
      e.preventDefault();
      const stroke = currentRef.current;
      currentRef.current = null;
      if (stroke.length > 0) {
        strokesRef.current = [...strokesRef.current, stroke];
        setStrokeCount(strokesRef.current.length);
      }
      paint();
    };

    const undo = () => {
      strokesRef.current = strokesRef.current.slice(0, -1);
      currentRef.current = null;
      setStrokeCount(strokesRef.current.length);
      paint();
    };

    const clear = () => {
      strokesRef.current = [];
      currentRef.current = null;
      setStrokeCount(0);
      paint();
    };

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full touch-none rounded-2xl border border-[var(--color-line)] bg-white"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={strokeCount === 0}
            className="min-h-10 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] text-sm font-semibold disabled:opacity-40"
          >
            {t("ryktetUndo")}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={strokeCount === 0}
            className="min-h-10 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] text-sm font-semibold disabled:opacity-40"
          >
            {t("ryktetClear")}
          </button>
        </div>
      </div>
    );
  }
);
