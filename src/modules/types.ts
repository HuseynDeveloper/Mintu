/**
 * Island Module System Types (Milestone 6)
 */

export interface ModuleContext {
  eventBus: any;
  activityManager: any;
  requestExpand?: () => void;
  requestCollapse?: () => void;
  isMintuInside?: () => boolean;
}

export interface IslandModule {
  id: string;
  name: string;
  icon: string; // SVG string
  priority: number;
  updateRateHz?: number; // e.g. 1 Hz for active timers/clocks

  start(context: ModuleContext): void;
  stop(): void;
  isActive(): boolean;

  /**
   * Render the compact view inside the dynamic island pill.
   */
  renderCompact(container: HTMLElement, options: { mintuInside: boolean }): void;

  /**
   * Render the expanded card view.
   */
  renderExpanded?(container: HTMLElement): void;

  /**
   * Render the settings panel for this module.
   */
  renderSettings?(container: HTMLElement): void;

  /**
   * Optional periodic tick called by the ModuleRegistry at updateRateHz.
   */
  onTick?(): void;

  /**
   * Called when the island visibility or expansion state changes.
   */
  onVisibilityChange?(visible: boolean): void;
}

export interface ModuleSettingsConfig {
  enabled: boolean;
  order: number;
  customSettings?: Record<string, any>;
}
