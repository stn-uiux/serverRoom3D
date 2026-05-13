import { useMemo, useEffect, useState, forwardRef, useRef } from "react";
import { CanvasTexture, Color, Mesh, SRGBColorSpace } from "three";
import { useFrame } from "@react-three/fiber";

interface DigitalClockProps {
  color?: string;
  dimensions?: [number, number, number];
  emissiveIntensity?: number;
  temperature?: number;
  humidity?: number;
}

export const DigitalClock = forwardRef<Mesh, DigitalClockProps>(
  (
    {
      color = "#1a1a1a",
      dimensions = [1.2, 0.85, 0.05],
      emissiveIntensity = 0.15,
      temperature = 24.5,
      humidity = 42,
    },
    ref,
  ) => {
    const baseCanvas = useMemo(() => {
      const c = document.createElement("canvas");
      c.width = 1100;
      c.height = 700;
      return c;
    }, []);

    const emissiveCanvas = useMemo(() => {
      const c = document.createElement("canvas");
      c.width = 1100;
      c.height = 700;
      return c;
    }, []);

    const baseTexture = useMemo(() => {
      const tex = new CanvasTexture(baseCanvas);
      tex.colorSpace = SRGBColorSpace;
      return tex;
    }, [baseCanvas]);

    const emissiveTexture = useMemo(() => {
      const tex = new CanvasTexture(emissiveCanvas);
      tex.colorSpace = SRGBColorSpace;
      return tex;
    }, [emissiveCanvas]);

    const [fontsLoaded, setFontsLoaded] = useState(false);

    useEffect(() => {
      const style = document.createElement("style");
      style.innerHTML = `
      @font-face { font-family: "D7MI"; src: url("/font/fonts-DSEG_v046/DSEG7-Classic/DSEG7Classic-Italic.woff") format('woff'); }
      @font-face { font-family: "D14MI"; src: url("/font/fonts-DSEG_v046/DSEG14-Classic/DSEG14Classic-Italic.woff") format('woff'); }
      @font-face { font-family: "D7MBI"; src: url("/font/fonts-DSEG_v046/DSEG7-Classic/DSEG7Classic-BoldItalic.woff") format('woff'); }
    `;
      document.head.appendChild(style);
      document.fonts.ready.then(() => setFontsLoaded(true));
      return () => {
        try {
          document.head.removeChild(style);
        } catch {}
      };
    }, []);

    const lastTimeRef = useRef(0);
    const staticDrawnRef = useRef(false);

    useFrame((state) => {
      const now = Math.floor(state.clock.elapsedTime);
      if (now === lastTimeRef.current) return;
      lastTimeRef.current = now;

      const ctx = baseCanvas.getContext("2d");
      const emissiveCtx = emissiveCanvas.getContext("2d");
      if (!ctx || !emissiveCtx) return;

      const time = new Date();
      const hours = String(time.getHours()).padStart(2, "0");
      const minutes = String(time.getMinutes()).padStart(2, "0");
      const seconds = String(time.getSeconds()).padStart(2, "0");
      const year = time.getFullYear();
      const month = String(time.getMonth() + 1).padStart(2, "0");
      const day = String(time.getDate()).padStart(2, "0");
      const dayName =
        ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][time.getDay()] + ".";

      // 1. Draw static background to Base Canvas (only once)
      if (!staticDrawnRef.current && fontsLoaded) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 1100, 700);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, 1100, 700);

        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.font = 'italic 80px "D7MI"';
        ctx.fillText("8888-88-88", 90, 60);
        ctx.font = 'italic 80px "D14MI"';
        ctx.fillText(" ~~~", 790, 60);
        ctx.font = 'italic bold 230px "D7MBI"';
        ctx.fillText("88:88", 60, 210);
        ctx.font = 'italic bold 110px "D7MBI"';
        ctx.fillText("88", 860, 330);

        const labelFont =
          '50px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
        const valueFont = 'italic 110px "D7MI"'; // Changed from D7MBI to D7MI for thinner text
        const labelColor = "white";

        // Fixed layout positions (canvas width = 1100)
        // Layout: "온도" [value] "℃  |  습도" [value] "%"
        const TEMP_LABEL_X = 30; // "온도"
        const TEMP_VALUE_X = 145; // temperature value (7-seg)
        const UNIT_LABEL_X = 510; // "℃  |  습도"
        const HUMID_VALUE_X = 780; // humidity value (7-seg)
        const PERCENT_X = 1010; // "%"
        const LABEL_Y = 580; // label baseline
        const VALUE_Y = 520; // value baseline

        // 온도 label
        ctx.font = labelFont;
        ctx.fillStyle = labelColor;
        ctx.fillText("온도", TEMP_LABEL_X, LABEL_Y);

        // Temperature shadow digits (88.8)
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.font = valueFont;
        ctx.fillText("88.8", TEMP_VALUE_X, VALUE_Y);

        // ℃ | 습도 label
        ctx.font = labelFont;
        ctx.fillStyle = labelColor;
        ctx.fillText("℃  |  습도", UNIT_LABEL_X, LABEL_Y);

        // Humidity shadow digits (88)
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.font = valueFont;
        ctx.fillText("88", HUMID_VALUE_X, VALUE_Y);

        // % label
        ctx.font = labelFont;
        ctx.fillStyle = labelColor;
        ctx.fillText("%", PERCENT_X, LABEL_Y);

        staticDrawnRef.current = true;
        baseTexture.needsUpdate = true;
      } else if (!fontsLoaded && !staticDrawnRef.current) {
        // Temporary background before fonts load
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 1100, 700);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, 1100, 700);
        baseTexture.needsUpdate = true;
      }

      // 2. Always redraw dynamic Emissive Canvas
      emissiveCtx.fillStyle = "#000000";
      emissiveCtx.fillRect(0, 0, 1100, 700);

      if (fontsLoaded) {
        emissiveCtx.textAlign = "left";
        emissiveCtx.textBaseline = "top";

        emissiveCtx.fillStyle = "rgba(81, 255, 0, 1)";
        emissiveCtx.font = 'italic 80px "D7MI"';
        emissiveCtx.fillText(`${year}-${month}-${day}`, 90, 60);
        emissiveCtx.font = 'italic 80px "D14MI"';
        emissiveCtx.fillText(` ${dayName}`, 790, 60);

        emissiveCtx.fillStyle = "rgba(255, 0, 0, 1)";
        emissiveCtx.font = 'italic bold 230px "D7MBI"';
        emissiveCtx.fillText(`${hours}:${minutes}`, 60, 210);
        emissiveCtx.font = 'italic bold 110px "D7MBI"';
        emissiveCtx.fillText(seconds, 860, 330);

        const valueFont = 'italic 110px "D7MI"'; // Changed from D7MBI to D7MI for thinner text
        const valueColor = "rgba(26, 240, 255, 1)";

        // Fixed layout positions (must match base canvas)
        const TEMP_VALUE_X = 145;
        const HUMID_VALUE_X = 780;
        const VALUE_Y = 520;

        // Draw temperature value (from props)
        const tempStr = temperature.toFixed(1);
        emissiveCtx.font = valueFont;
        emissiveCtx.fillStyle = valueColor;
        emissiveCtx.fillText(tempStr, TEMP_VALUE_X, VALUE_Y);

        // Draw humidity value (from props)
        const humStr = Math.round(humidity).toString();
        emissiveCtx.font = valueFont;
        emissiveCtx.fillStyle = valueColor;
        emissiveCtx.fillText(humStr, HUMID_VALUE_X, VALUE_Y);
      } else {
        emissiveCtx.fillStyle = "white";
        emissiveCtx.font = "bold 100px sans-serif";
        emissiveCtx.textAlign = "center";
        emissiveCtx.textBaseline = "alphabetic";
        emissiveCtx.fillText(`${hours}:${minutes}:${seconds}`, 1100 / 2, 350);
      }

      emissiveTexture.needsUpdate = true;
    });

    return (
      <group position={[0, dimensions[1] / 2, 0]}>
        {/* Clock Case & Screen */}
        <mesh ref={ref} castShadow receiveShadow>
          <boxGeometry args={dimensions} />
          {[0, 1, 2, 3, 5].map((idx) => (
            <meshStandardMaterial
              key={idx}
              attach={`material-${idx}`}
              color={color}
              roughness={0.5}
              metalness={0.2}
            />
          ))}
          <meshStandardMaterial
            attach="material-4"
            map={baseTexture}
            emissive={new Color(8, 8, 8)}
            emissiveIntensity={emissiveIntensity * 12}
            emissiveMap={emissiveTexture}
            toneMapped={false}
            transparent={true}
          />
        </mesh>

        {/* Glass Front Panel */}
        <mesh position={[0, 0, dimensions[2] / 2 + 0.002]} renderOrder={2}>
          <planeGeometry args={[dimensions[0] - 0.04, dimensions[1] - 0.04]} />
          <meshStandardMaterial
            transparent={true}
            opacity={0.1}
            color="#e0f2fe"
            roughness={0.01}
            metalness={1.0}
            depthWrite={false}
            envMapIntensity={2}
          />
        </mesh>
      </group>
    );
  },
);

DigitalClock.displayName = "DigitalClock";
