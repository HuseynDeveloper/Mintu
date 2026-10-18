/**
 * Shared Island Layout Manager
 * Enforces strict slot separation so no component can place content underneath Mintu.
 *
 * Slots:
 * - mintuSlot: Reserved 52px width on the left when Mintu is inside the island.
 * - content: Dynamic body for notifications, status widgets, timers, music, context cards.
 * - trailing: Optional right-aligned controls (e.g. dismiss button, status dot, action buttons).
 */

export interface IslandLayoutOptions {
  mintuInside: boolean;
  content: string | HTMLElement;
  trailing?: string | HTMLElement;
  extraClass?: string;
  minGapPx?: number;
}

export class IslandLayout {
  public static readonly MINTU_SLOT_WIDTH_PX = 52;
  public static readonly MIN_GAP_PX = 8;

  /**
   * Generates standard Island Layout HTML.
   */
  public static html(options: IslandLayoutOptions): string {
    const { mintuInside, content, trailing, extraClass } = options;
    const contentHtml = typeof content === "string" ? content : content.outerHTML;
    const trailingHtml = trailing
      ? typeof trailing === "string"
        ? trailing
        : trailing.outerHTML
      : "";

    return `
      <div class="island-layout ${mintuInside ? "has-mintu-slot" : "mintu-less"} ${extraClass || ""}">
        ${mintuInside ? '<div class="island-slot-mintu" data-slot="mintuSlot"></div>' : ""}
        <div class="island-slot-content" data-slot="content">
          ${contentHtml}
        </div>
        ${
          trailingHtml
            ? `<div class="island-slot-trailing" data-slot="trailing">${trailingHtml}</div>`
            : ""
        }
      </div>
    `;
  }

  /**
   * Renders into an existing container and attaches optional elements.
   */
  public static render(container: HTMLElement, options: IslandLayoutOptions): HTMLElement {
    container.innerHTML = this.html(options);
    const layoutEl = container.querySelector(".island-layout") as HTMLElement;
    return layoutEl;
  }
}
