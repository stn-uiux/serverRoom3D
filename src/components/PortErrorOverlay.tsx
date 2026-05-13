import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, FrontSide, MeshBasicMaterial } from 'three';
import type { PortState } from "../types";
import { ERROR_COLORS } from "../utils/errorHelpers";
import { resolveDeviceSvgContent } from "../utils/deviceAssets";

interface PortErrorOverlayProps {
  modelName: string;
  portStates: PortState[];
  worldWidth: number;
  worldHeight: number;
}

interface PortRect {
  id: string;
  color: string;
  nx: number; // 0~1 정규화
  ny: number;
  nw: number;
  nh: number;
}

/** SVG path d 속성 → bounding box (순수 문자열 파싱, getBBox 미사용) */
function parseDPath(d: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const tokens = d.trim().split(/(?=[MmHhVvZz])/);
  let cx = 0, cy = 0;
  const xs: number[] = [], ys: number[] = [];
  for (const tok of tokens) {
    if (!tok.trim()) continue;
    const cmd = tok[0];
    const args = (tok.slice(1).match(/-?[\d.]+(?:e[+-]?\d+)?/gi) ?? []).map(Number);
    switch (cmd) {
      case "M": cx = args[0]; cy = args[1]; xs.push(cx); ys.push(cy); break;
      case "H": cx = args[0]; xs.push(cx); break;
      case "V": cy = args[0]; ys.push(cy); break;
      case "L": cx = args[0]; cy = args[1]; xs.push(cx); ys.push(cy); break;
    }
  }
  if (!xs.length || !ys.length) return null;
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** SVG 텍스트에서 에러 포트들의 정규화 bbox 추출 */
function extractPortRects(svgText: string, errorPortIds: Map<string, string>): PortRect[] {
  if (!svgText || errorPortIds.size === 0) return [];

  const vbMatch = svgText.match(/viewBox=["']([^"']+)["']/);
  let svgW = 984, svgH = 96;
  if (vbMatch) {
    const p = vbMatch[1].trim().split(/\s+/);
    if (p.length >= 4) { svgW = parseFloat(p[2]) || svgW; svgH = parseFloat(p[3]) || svgH; }
  }

  const result: PortRect[] = [];
  errorPortIds.forEach((color, portId) => {
    const idIdx = svgText.indexOf(`id="${portId}"`);
    if (idIdx === -1) return;
    const chunk = svgText.slice(Math.max(0, idIdx - 500), idIdx + 500);
    const dm = chunk.match(/\bd=["']([^"']+)["']/);
    if (!dm) return;
    const bbox = parseDPath(dm[1]);
    if (!bbox) return;
    result.push({
      id: portId, color,
      nx: bbox.minX / svgW,
      ny: bbox.minY / svgH,
      nw: (bbox.maxX - bbox.minX) / svgW,
      nh: (bbox.maxY - bbox.minY) / svgH,
    });
  });
  return result;
}

/**
 * PortErrorOverlay – CanvasTexture 방식
 *
 * Three.js PlaneGeometry에 CanvasTexture를 적용하고, useFrame으로
 * 매 프레임 캔버스에 에러 포트 사각형을 다시 그려 반짝임을 구현한다.
 *
 * 핵심: texture를 JSX의 map prop으로 직접 전달 → mesh 마운트 타이밍 문제 없음
 */
export const PortErrorOverlay = ({
  modelName,
  portStates,
  worldWidth,
  worldHeight,
}: PortErrorOverlayProps) => {
  const matRef = useRef<MeshBasicMaterial>(null);

  // error 포트 → 색상
  const errorPortIds = useMemo(
    () =>
      new Map(
        portStates
          .filter((p) => p.status === "error")
          .map((p) => [p.portId, p.errorLevel ? ERROR_COLORS[p.errorLevel] : "#ef4444"]),
      ),
    [portStates],
  );

  // SVG raw text (비동기)
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    resolveDeviceSvgContent(modelName).then((content) => {
      if (isMounted) setSvgContent(content ?? null);
    });
    return () => { isMounted = false; };
  }, [modelName]);

  // 포트 bbox 추출
  const portRects = useMemo(() => {
    if (!svgContent) {
      console.warn("[PortErrorOverlay] svgContent is null for:", modelName);
      return [];
    }
    const rects = extractPortRects(svgContent, errorPortIds);
    return rects;
  }, [svgContent, errorPortIds, modelName]);

  // Canvas + Texture (portRects가 바뀔 때만 재생성)
  const texture = useMemo(() => {
    if (portRects.length === 0) return null;
    const CANVAS_W = 2048;
    const CANVAS_H = Math.max(1, Math.round(CANVAS_W * (worldHeight / worldWidth)));
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const tex = new CanvasTexture(canvas);
    return { tex, canvas };
  }, [portRects, worldWidth, worldHeight]);

  // texture 교체 시 material에 연결
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    if (texture) {
      mat.map = texture.tex;
    } else {
      mat.map = null;
    }
    mat.needsUpdate = true;
    return () => {
      texture?.tex.dispose();
    };
  }, [texture]);

  // portRects ref (useFrame 클로저에서 항상 최신값 참조)
  const portRectsRef = useRef(portRects);
  portRectsRef.current = portRects;

  // 매 프레임 캔버스 다시 그리기 → 반짝임
  useFrame(({ clock }) => {
    if (!texture || portRectsRef.current.length === 0) return;
    const { canvas, tex } = texture;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const t = clock.getElapsedTime();
    const blink = 0.5 + Math.sin(t * Math.PI * 1.8) * 0.5; // 0~1

    ctx.clearRect(0, 0, W, H);

    portRectsRef.current.forEach(({ color, nx, ny, nw, nh }) => {
      const px = nx * W;
      const py = ny * H;
      const pw = nw * W;
      const ph = nh * H;

      // 배경
      ctx.globalAlpha = 0.08 + blink * 0.55;
      ctx.fillStyle = color;
      ctx.fillRect(px, py, pw, ph);

      // 테두리
      ctx.globalAlpha = 0.35 + blink * 0.65;
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
    });

    tex.needsUpdate = true;
  });

  if (portRects.length === 0 || !texture) return null;

  return (
    <mesh position={[0, 0, 0.002]}>
      <planeGeometry args={[worldWidth, worldHeight]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture.tex}
        transparent
        opacity={1}
        depthWrite={false}
        side={FrontSide}
      />
    </mesh>
  );
};
