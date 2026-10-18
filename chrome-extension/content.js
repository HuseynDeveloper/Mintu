/**
 * Mintu Living Companion — Content Script
 * Injects draggable floating companion and selection helper on web pages.
 */

(function () {
  if (window.__mintuCompanionInjected) return;
  window.__mintuCompanionInjected = true;

  let isDragging = false;
  let startX = 0, startY = 0;
  let initialLeft = 0, initialTop = 0;
  let hasMoved = false;

  // 1. Create Floating Companion DOM
  const container = document.createElement("div");
  container.id = "mintu-floating-container";
  container.className = "mintu-hidden";

  container.innerHTML = `
    <div class="mintu-speech-bubble" id="mintu-speech-bubble">
      <div class="mintu-bubble-text">Salam! Mən Mintu.</div>
      <button class="mintu-bubble-action" id="mintu-act-sidepanel">Sual ver / Çat aç</button>
      <button class="mintu-bubble-action" id="mintu-act-summarize">Səhifəni xülasələndir</button>
      <button class="mintu-bubble-action" id="mintu-act-hide">Gizlət</button>
    </div>
    <div class="mintu-pet-widget" id="mintu-pet-widget" title="Mintu Living Pet — Klikləyin və ya sürükləyin">
      <svg class="mintu-pet-svg" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
        <g id="pet-body">
          <path d="M 80,44 C 108,44 126,62 126,92 C 126,122 110,140 80,140 C 50,140 34,122 34,92 C 34,62 52,44 80,44 Z"
                fill="#9ae6b4" stroke="#22543d" stroke-width="4" />
          <ellipse cx="80" cy="108" rx="28" ry="24" fill="#fef3c7" />
          <path d="M 46,54 C 36,36 46,26 56,38 Z" fill="#9ae6b4" stroke="#22543d" stroke-width="3.5" />
          <path d="M 114,54 C 124,36 114,26 104,38 Z" fill="#9ae6b4" stroke="#22543d" stroke-width="3.5" />
          <g id="eye-left"><circle cx="64" cy="80" r="5" fill="#1e293b" /><circle cx="66" cy="78" r="1.8" fill="#ffffff" /></g>
          <g id="eye-right"><circle cx="96" cy="80" r="5" fill="#1e293b" /><circle cx="98" cy="78" r="1.8" fill="#ffffff" /></g>
          <ellipse cx="52" cy="88" rx="5" ry="3" fill="#fca5a5" opacity="0.65" />
          <ellipse cx="108" cy="88" rx="5" ry="3" fill="#fca5a5" opacity="0.65" />
          <path d="M 74,88 Q 80,94 86,88" fill="none" stroke="#22543d" stroke-width="2.5" stroke-linecap="round" />
        </g>
      </svg>
    </div>
  `;

  document.body.appendChild(container);

  // 2. Create Floating Selection Pill without emojis
  const pill = document.createElement("div");
  pill.id = "mintu-selection-pill";
  pill.innerHTML = `<span>Ask Mintu</span>`;
  document.body.appendChild(pill);

  const petWidget = document.getElementById("mintu-pet-widget");
  const speechBubble = document.getElementById("mintu-speech-bubble");
  const actSidepanel = document.getElementById("mintu-act-sidepanel");
  const actSummarize = document.getElementById("mintu-act-summarize");
  const actHide = document.getElementById("mintu-act-hide");

  // Draggable logic for pet widget
  petWidget.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = container.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    container.style.bottom = "auto";
    container.style.right = "auto";
    container.style.left = `${initialLeft}px`;
    container.style.top = `${initialTop}px`;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved = true;
      speechBubble.classList.remove("mintu-bubble-open");
    }

    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;

    newLeft = Math.max(10, Math.min(window.innerWidth - 74, newLeft));
    newTop = Math.max(10, Math.min(window.innerHeight - 74, newTop));

    container.style.left = `${newLeft}px`;
    container.style.top = `${newTop}px`;
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    if (!hasMoved) {
      speechBubble.classList.toggle("mintu-bubble-open");
    }
  }

  // Bubble button clicks
  actHide.addEventListener("click", () => {
    container.classList.add("mintu-hidden");
    speechBubble.classList.remove("mintu-bubble-open");
  });

  actSidepanel.addEventListener("click", () => {
    speechBubble.classList.remove("mintu-bubble-open");
    chrome.runtime.sendMessage({ type: "mintu:context-action", action: "open-panel" }).catch(() => {});
  });

  actSummarize.addEventListener("click", () => {
    speechBubble.classList.remove("mintu-bubble-open");
    chrome.runtime.sendMessage({ type: "mintu:context-action", action: "summarize-page" }).catch(() => {});
  });

  // Text selection helper pill
  document.addEventListener("mouseup", (e) => {
    if (pill.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";

      if (text.length > 2 && text.length < 1500) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          pill.style.display = "flex";
          pill.style.top = `${window.scrollY + rect.top - 36}px`;
          pill.style.left = `${window.scrollX + rect.left + rect.width / 2 - 40}px`;
          return;
        }
      }
      pill.style.display = "none";
    }, 10);
  });

  pill.addEventListener("click", () => {
    const text = window.getSelection() ? window.getSelection().toString().trim() : "";
    pill.style.display = "none";
    if (text) {
      chrome.runtime.sendMessage({
        type: "mintu:context-action",
        action: "explain",
        text: text,
      }).catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "toggle-mintu-float") {
      container.classList.toggle("mintu-hidden");
      sendResponse({ status: "ok", visible: !container.classList.contains("mintu-hidden") });
    }
  });
})();
