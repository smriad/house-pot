import { sleep } from "./demo-env.mjs";

export async function injectDemoCursor(page) {
  await page.addInitScript(() => {
    if (document.getElementById("hp-demo-cursor")) return;
    const ring = document.createElement("div");
    ring.id = "hp-demo-cursor";
    Object.assign(ring.style, {
      position: "fixed",
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      background: "rgba(232, 121, 42, 0.85)",
      border: "3px solid #fff",
      boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      zIndex: "2147483647",
      pointerEvents: "none",
      transform: "translate(-50%, -50%)",
      left: "0px",
      top: "0px",
      transition: "left 0.12s linear, top 0.12s linear",
    });
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "fixed",
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "#1a1a1a",
      zIndex: "2147483647",
      pointerEvents: "none",
      transform: "translate(-50%, -50%)",
      left: "0px",
      top: "0px",
      transition: "left 0.12s linear, top 0.12s linear",
    });
    dot.id = "hp-demo-cursor-dot";
    document.documentElement.appendChild(ring);
    document.documentElement.appendChild(dot);
    window.__hpDemoX = 80;
    window.__hpDemoY = 80;
    const move = (x, y) => {
      window.__hpDemoX = x;
      window.__hpDemoY = y;
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
    };
    move(80, 80);
    document.addEventListener(
      "mousemove",
      (e) => move(e.clientX, e.clientY),
      true,
    );
  });
}

/** Widen layout and bump type for 1080p demo capture (fullscreen-style frame). */
export async function injectFullscreenDemoLayout(page) {
  await page.addInitScript(() => {
    const id = "hp-demo-fullscreen-layout";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      html { font-size: 19px; scroll-behavior: smooth; }
      body { overflow-x: hidden; }
      .hp-page { min-height: 100vh; }
      .hp-container {
        max-width: 100% !important;
        width: 100% !important;
        padding-left: 2.75rem !important;
        padding-right: 2.75rem !important;
      }
      main.hp-container {
        max-width: 100% !important;
        grid-template-columns: 1fr !important;
        gap: 2rem !important;
      }
      .hp-display-title { font-size: clamp(2.8rem, 3.5vw, 4rem) !important; }
      .hp-section-title { font-size: 2rem !important; }
      .hp-input, .hp-textarea { font-size: 1.05rem !important; }
    `;
    document.documentElement.appendChild(style);
  });
}

export async function smoothMove(page, x, y, steps = 18) {
  const start = await page.evaluate(() => ({
    x: window.__hpDemoX ?? 80,
    y: window.__hpDemoY ?? 80,
  }));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = start.x + (x - start.x) * t;
    const ny = start.y + (y - start.y) * t;
    await page.mouse.move(nx, ny);
    await sleep(20);
  }
}

export async function pointTo(page, locator, { pauseMs = 500 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  await sleep(200);
  const box = await locator.boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await smoothMove(page, x, y);
  await sleep(pauseMs);
}

export async function clickWithCursor(page, locator) {
  await pointTo(page, locator, { pauseMs: 350 });
  await locator.click();
}
