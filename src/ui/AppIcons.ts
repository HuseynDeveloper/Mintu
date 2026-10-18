/**
 * Source App SVG Icons for Island Notifications
 * Supports Discord, Telegram, Chrome, Edge, Mail, Calendar, VS Code, Slack, WhatsApp, Spotify, Mintu, and clean fallback.
 */

export function getAppIconSvg(appName?: string, fallbackIcon?: string): string {
  if (fallbackIcon) {
    return fallbackIcon;
  }
  const norm = (appName || "").toLowerCase();

  if (norm.includes("antigravity")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#18181B" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <path d="M12 5L6 17h3.5l1.3-2.8h4.4L16.5 17H20L14 5h-2zm0 4.2l1.6 3.6h-3.2L12 9.2z" fill="#A8E8D5" />
      </svg>
    `;
  }

  if (norm.includes("powershell") || norm.includes("terminal") || norm.includes("console")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#012456" />
        <path d="M6.5 8.5L10 12l-3.5 3.5 1.2 1.2 4.7-4.7-4.7-4.7-1.2 1.2zm6 7.5h5v1.5h-5V16z" fill="#FFFFFF" />
      </svg>
    `;
  }

  if (norm.includes("discord")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#5865F2" />
        <path d="M19.3 5.3A16.6 16.6 0 0 0 15.2 4a12.8 12.8 0 0 0-.6 1.3 15.5 15.5 0 0 0-5.2 0A12.8 12.8 0 0 0 8.8 4a16.6 16.6 0 0 0-4.1 1.3C2.1 9.2 1.6 14 1.9 18.7a16.7 16.7 0 0 0 5.1 2.6c.4-.6.8-1.2 1.1-1.9a10.9 10.9 0 0 1-1.8-.9c.2-.1.3-.2.5-.3a12 12 0 0 0 10.4 0c.2.1.3.2.5.3-.6.4-1.2.7-1.8.9.3.7.7 1.3 1.1 1.9a16.6 16.6 0 0 0 5.1-2.6c.4-5.3-.7-10-3-13.4zM8.5 15.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" fill="#ffffff" />
      </svg>
    `;
  }

  if (norm.includes("telegram")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#24A1DE" />
        <path d="M18.8 6.2l-2.6 12.3c-.2.9-.7 1.1-1.5.7l-4-3-1.9 1.9c-.2.2-.4.4-.8.4l.3-4.1 7.4-6.7c.3-.3-.1-.4-.5-.2l-9.2 5.8-4-1.2c-.9-.3-.9-.9.2-1.3L17.3 5c.7-.3 1.4.2 1.5 1.2z" fill="#ffffff" />
      </svg>
    `;
  }

  if (norm.includes("chrome") || norm.includes("google chrome")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <circle cx="12" cy="12" r="11" fill="#EA4335" />
        <circle cx="12" cy="12" r="5" fill="#ffffff" />
        <circle cx="12" cy="12" r="4" fill="#4285F4" />
        <path d="M12 2a10 10 0 0 1 8.7 5H12z" fill="#FBBC05" />
        <path d="M21.7 17A10 10 0 0 1 12 22v-5z" fill="#34A853" />
      </svg>
    `;
  }

  if (norm.includes("edge") || norm.includes("msedge")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#0078D7" />
        <path d="M18.5 13.5c0 3-2.5 5.5-5.5 5.5-3.5 0-6.5-2.5-6.5-6.5 0-4 3-7 7-7 2.2 0 4 1 5 2.5l-3 1.5c-.5-.7-1.2-1-2-1-2.2 0-3.8 1.8-3.8 4 0 .3 0 .7.1 1 1.2-1.5 3-2.5 5.2-2.5 2 0 3.5 1.1 3.5 2.5z" fill="#50E6FF" />
      </svg>
    `;
  }

  if (norm.includes("mail") || norm.includes("outlook") || norm.includes("thunderbird")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#0078D4" />
        <path d="M4 7l8 6 8-6v10H4V7z" fill="#ffffff" opacity="0.95" />
        <path d="M20 7l-8 6-8-6h16z" fill="#28A8EA" />
      </svg>
    `;
  }

  if (norm.includes("calendar")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#107C41" />
        <rect x="5" y="8" width="14" height="11" rx="2" fill="#ffffff" />
        <rect x="5" y="5" width="14" height="4" fill="#232733" opacity="0.3" />
        <circle cx="9" cy="12" r="1.2" fill="#107C41" />
        <circle cx="15" cy="12" r="1.2" fill="#107C41" />
        <circle cx="9" cy="15" r="1.2" fill="#107C41" />
        <circle cx="15" cy="15" r="1.2" fill="#107C41" />
      </svg>
    `;
  }

  if (norm.includes("code") || norm.includes("vscode") || norm.includes("visual studio")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#007ACC" />
        <path d="M17.5 4.5l-8 7.5 8 7.5 2-1V5.5l-2-1zm-9.3 7.5L5 9.5l-1.5 1 3 2.5-3 2.5 1.5 1 3.2-2.5z" fill="#ffffff" />
      </svg>
    `;
  }

  if (norm.includes("slack")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#4A154B" />
        <path d="M6 10.5a1.5 1.5 0 1 1 1.5-1.5v1.5H6zm2.5 0a1.5 1.5 0 0 1 3 0v3.5a1.5 1.5 0 0 1-3 0v-3.5zm5-4.5a1.5 1.5 0 1 1 1.5 1.5H13.5V6zm0 2.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 1 0-3h3.5zm4.5 5a1.5 1.5 0 1 1-1.5 1.5V13.5H18zm-2.5 0a1.5 1.5 0 0 1-3 0V10a1.5 1.5 0 0 1 3 0v3.5zm-5 4.5a1.5 1.5 0 1 1-1.5-1.5h1.5v1.5zm0-2.5a1.5 1.5 0 0 1 0-3H14a1.5 1.5 0 0 1 0 3h-3.5z" fill="#ECB22E" />
      </svg>
    `;
  }

  if (norm.includes("whatsapp")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#25D366" />
        <path d="M12 4a8 8 0 0 0-6.9 12l-1.1 4 4.1-1.1A8 8 0 1 0 12 4zm4.7 11.3c-.2.6-1.2 1.1-1.7 1.1-.4 0-1 .2-3.1-.7-2.6-1.1-4.2-3.8-4.3-4-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 1-2.2.2-.2.5-.3.8-.3h.6c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.1.2-.2.3-.3.5-.2.2-.3.4-.5.5-.2.2-.4.4-.2.7.2.4 1 1.6 2.1 2.6 1.4 1.3 2.6 1.7 3 1.9.4.2.6.2.8 0 .3-.3 1.1-1.3 1.4-1.7.3-.4.6-.3 1-.2.4.2 2.4 1.1 2.8 1.3.4.2.7.3.8.5.1.2.1 1.2-.1 1.8z" fill="#ffffff" />
      </svg>
    `;
  }

  if (norm.includes("spotify")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#1DB954" />
        <circle cx="12" cy="12" r="9" fill="#121212" />
        <path d="M7 10c3-1 7-1 10 .5m-9.5 3c2.5-.8 6-.6 8.5.5m-7.5 3c2-.6 5-.4 7 .5" stroke="#1DB954" stroke-width="1.8" stroke-linecap="round" fill="none" />
      </svg>
    `;
  }

  if (norm.includes("mintu") || norm.includes("system") || norm.includes("internal")) {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22">
        <rect width="24" height="24" rx="6" fill="#10B981" />
        <circle cx="8.5" cy="10" r="1.5" fill="#042F2E" />
        <circle cx="15.5" cy="10" r="1.5" fill="#042F2E" />
        <path d="M10 14.5c1 1 3 1 4 0" stroke="#042F2E" stroke-width="1.5" stroke-linecap="round" fill="none" />
      </svg>
    `;
  }

  // Fallback icon: Sleek modern app window badge (never empty)
  return `
    <svg viewBox="0 0 24 24" width="22" height="22">
      <defs>
        <linearGradient id="neutralAppGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#374151" />
          <stop offset="100%" stop-color="#1F2937" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#neutralAppGrad)" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
      <rect x="5" y="7" width="14" height="11" rx="2" fill="none" stroke="#9CA3AF" stroke-width="1.3" />
      <line x1="5" y1="10" x2="19" y2="10" stroke="#9CA3AF" stroke-width="1.2" />
      <circle cx="7.5" cy="8.5" r="0.7" fill="#6B7280" />
      <circle cx="9.5" cy="8.5" r="0.7" fill="#6B7280" />
    </svg>
  `;
}
