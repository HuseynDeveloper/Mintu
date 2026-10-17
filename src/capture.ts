/**
 * Mintu Screen Region Capture Overlay (Image F)
 * Crosshair selection, dimmed backdrop, live dimension badge,
 * peeking Mintu pet, Windows Media OCR execution with bulletproof dismissal.
 */

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PetRenderer } from "./pet/PetRenderer";
import { AnimationController } from "./pet/AnimationController";

let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

const selectionBox = document.getElementById("selection-box")!;
const dimBadge = document.getElementById("dim-badge")!;
const canvas = document.getElementById("cutout-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusBubble = document.getElementById("capture-status-bubble");
const cancelBtn = document.getElementById("btn-cancel-overlay");

// Mount peeking pet (Image F)
const petContainer = document.getElementById("peeking-mintu-pet")!;
const petRenderer = new PetRenderer(true);
const animController = new AnimationController();
animController.setState("curious");
petContainer.appendChild(petRenderer.container);

// Render loop for peeking Mintu
function animLoop() {
  const now = performance.now() / 1000;
  const pose = animController.update(now, 0.016);
  petRenderer.render(pose);
  requestAnimationFrame(animLoop);
}
requestAnimationFrame(animLoop);

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawCutout();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawCutout() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!isDragging && selectionBox.style.display !== "block") return;

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  if (width > 0 && height > 0) {
    // Clear the selected rectangle to make it transparent/bright
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(left, top, width, height);
  }
}

// Mouse events
window.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return; // Left click only
  if ((e.target as HTMLElement).closest("#peeking-mintu-container")) return;

  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  currentX = e.clientX;
  currentY = e.clientY;

  selectionBox.style.display = "block";
  updateSelectionUi();
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  currentX = e.clientX;
  currentY = e.clientY;

  updateSelectionUi();
  drawCutout();
});

window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  if (width >= 24 && height >= 24) {
    confirmCapture();
  } else {
    // Too small, reset
    selectionBox.style.display = "none";
    drawCutout();
  }
});

// Right click dismisses overlay immediately
window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  cancelCapture();
});

// Explicit Cancel Button
cancelBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  cancelCapture();
});

function updateSelectionUi() {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;

  dimBadge.textContent = `${Math.round(width)} × ${Math.round(height)}`;
}

// Keyboard shortcuts: Esc to cancel, Enter to confirm
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    cancelCapture();
  } else if (e.key === "Enter") {
    e.preventDefault();
    confirmCapture();
  }
});

async function cancelCapture() {
  selectionBox.style.display = "none";
  drawCutout();
  await closeCaptureWindow();
}

async function confirmCapture() {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  if (width < 12 || height < 12) {
    await cancelCapture();
    return;
  }

  if (statusBubble) {
    statusBubble.innerHTML = `<span>Reading screen with OCR...</span>`;
  }

  try {
    const scale = window.devicePixelRatio || 1;
    const res = await invoke("capture_region_and_ocr", {
      x: Math.round(left * scale),
      y: Math.round(top * scale),
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    });

    await emit("context-captured", res);
  } catch (err) {
    console.error("[RegionCapture] Error during capture/ocr:", err);
  } finally {
    await closeCaptureWindow();
  }
}

async function closeCaptureWindow() {
  // Always hide visual elements first
  selectionBox.style.display = "none";
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  try {
    // 1. Preferred: Direct Rust IPC command
    await invoke("close_region_capture");
  } catch (e1) {
    console.warn("Rust close_region_capture failed, trying webview window hide:", e1);
  }

  try {
    // 2. Fallback: Tauri Core Window API
    const win = getCurrentWindow();
    await win.hide();
  } catch (e2) {
    console.warn("Window.hide() failed:", e2);
  }
}
