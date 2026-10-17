/**
 * Mintu Speech Bubble (Image C Reference)
 * Sleek white rounded bubble with dark text, subtle drop shadow,
 * cute pointing tail, and smooth spring entrance/exit.
 */

export class SpeechBubble {
  public readonly el: HTMLElement;
  private textEl: HTMLElement;
  private hideTimeout: number | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "mintu-speech-bubble";
    this.el.innerHTML = `
      <div class="bubble-content">
        <span class="bubble-text"></span>
      </div>
      <div class="bubble-tail"></div>
    `;
    this.textEl = this.el.querySelector(".bubble-text")!;
  }

  say(text: string, durationMs: number = 4200): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this.textEl.textContent = text;
    this.el.classList.add("visible");

    this.hideTimeout = window.setTimeout(() => {
      this.hide();
    }, durationMs);
  }

  hide(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.el.classList.remove("visible");
  }

  updatePosition(petX: number, petY: number): void {
    const bubbleW = 180;
    const bubbleH = 50;
    let left = petX - bubbleW + 30;
    let top = petY - bubbleH - 18;
    if (left < 16) left = petX + 90;
    if (top < 60) top = petY + 100;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }
}

