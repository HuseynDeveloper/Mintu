# Privacy Policy for Mintu

**Last Updated:** October 30, 2026

Mintu ("we", "our", or "the application") is an open-source, local-first living desktop companion and Dynamic Island application. Your privacy is fundamental to our design philosophy. Mintu is engineered from the ground up to operate locally on your device without intrusive tracking, telemetry, or unauthorized data transmission.

This Privacy Policy explains what information Mintu accesses, how that information is handled, and the principles that govern our software.

---

## 1. Core Principle: Zero Telemetry and Local-First Architecture

* **No Analytics or Telemetry:** Mintu does not contain tracking code, analytics SDKs, advertising frameworks, or user behavioral telemetry.
* **No Account Creation:** Using Mintu does not require creating an account, providing an email address, or registering personal identification.
* **No Cloud Synchronization by Default:** All conversation history, application settings, reminders, and contextual memories are stored strictly on your local device in an offline SQLite database.
* **No Data Selling:** We do not collect, monetize, rent, or sell user data under any circumstances.

---

## 2. Information Handled by Application Features

Mintu integrates deeply with your desktop operating system to provide ambient companion features and contextual assistance. All data access occurs under your direct control and stays on your device:

### A. Screen Capture and Optical Character Recognition (OCR)
* **On-Demand Activation:** Mintu captures screen regions or active windows only when you explicitly trigger the action (via global hotkey or the capture interface).
* **Local Processing:** Screen captures are analyzed on-device using offline optical character recognition (Windows Media OCR on Windows, local text processing on macOS).
* **Immediate Disposal:** Captured screen bitmaps are processed in transient device memory and discarded immediately after text extraction. Unsaved screenshots are not stored to disk or transmitted across the network.
* **Privacy Guardian Blocklist:** Mintu features an active Privacy Guardian that automatically detects sensitive applications (such as password managers including 1Password, Bitwarden, KeePass, LastPass, Authy, and credential managers) and refuses to capture or inspect their contents.

### B. Active Window Context
* Mintu inspects the title and executable process name of the active foreground window solely to enforce privacy blocklists and provide local context-aware assistance when requested. This metadata remains strictly on your device.

### C. System Notifications
* Mintu accesses incoming system toast notifications through the local operating system notification APIs to display Dynamic Island alert pills and status indicators.
* Notification payloads are processed in volatile memory and are never transmitted to external servers.

### D. Media Playback Controls
* Mintu reads current media playback metadata (track title, artist, playback state) via local system media transport controls (Windows SMTC or macOS media controllers) exclusively to render playback widgets and controls within the Dynamic Island.

### E. Hardware and System Metrics
* Mintu inspects system hardware capabilities (CPU core count, physical RAM, disk free space, battery status) to:
  1. Recommend suitable local artificial intelligence models tailored to your machine's hardware tier.
  2. Display battery and performance status in the island interface.
* This hardware telemetry never leaves your device.

### F. Clipboard Interaction
* Mintu only reads from or writes to the system clipboard when you explicitly invoke clipboard-related actions or smart translation tools. Clipboard contents are never logged or transmitted in the background.

---

## 3. Artificial Intelligence and Cloud Service Integrations

### A. Local Offline AI (llama.cpp)
* When running local models, all inference executes 100% offline via a local `llama-server` process bound exclusively to your localhost loopback interface (`127.0.0.1`).
* Your conversation prompts, uploaded context, and model outputs never leave your physical computer.

### B. Optional Third-Party Cloud AI Providers
* Mintu allows you to optionally connect your own API keys for third-party cloud providers (such as OpenAI, Anthropic, Google Gemini, or Groq).
* **Credential Protection:** API keys entered into Mintu are stored securely in your operating system's native credential vault (Windows Credential Manager via Win32 DPAPI or macOS Keychain) and are never transmitted to Mintu contributors or unauthorized third parties.
* **Direct Transmission:** When you choose to chat using a third-party cloud model, your prompt and any user-selected context are transmitted directly from your device to the respective provider's official API endpoint over encrypted HTTPS.
* The processing of data transmitted to third-party providers is governed by the respective provider's privacy policy:
  * OpenAI Privacy Policy: https://openai.com/privacy
  * Anthropic Privacy Policy: https://www.anthropic.com/privacy
  * Google Gemini Privacy Policy: https://policies.google.com/privacy
  * Groq Privacy Policy: https://groq.com/privacy-policy

### C. Model Downloads
* When you initiate the download of an open-weight GGUF model within Mintu, the file is retrieved directly from official repositories (such as Hugging Face) using secure HTTPS with SHA-256 integrity verification.

---

## 4. Data Storage, Retention, and User Control

* **Storage Location:** All persistent data (including conversation logs, user memories, custom blocklists, and reminders) is saved locally in your user profile directory (`%LOCALAPPDATA%\com.mintu.desktop` on Windows or `~/Library/Application Support/com.mintu.desktop` on macOS).
* **Data Deletion:** You retain complete control over your data. You can delete individual chat threads, wipe conversation history, or remove stored API keys directly within Mintu's Settings interface. Uninstalling the application or deleting the application data folder completely removes all associated records.

---

## 5. Security Measures

Mintu applies defense-in-depth principles:
* API keys are isolated in operating system security vaults rather than plaintext configuration files.
* Prompt injection boundaries wrap all ambient system context before passing it to AI models.
* The local inference server binds strictly to the loopback interface (`127.0.0.1`) with a randomly generated session authorization token.

---

## 6. Children's Privacy

Mintu does not collect, retain, or process personal data from any users, including children under the age of 13.

---

## 7. Changes to This Privacy Policy

Any revisions to this Privacy Policy will be reflected in the project repository with an updated revision date. Material changes will be noted in application release notes.

---

## 8. Contact and Open-Source Transparency

Mintu is an open-source project. Its complete source code is publicly accessible and auditable by anyone.

If you have questions, feedback, or concerns regarding this Privacy Policy or Mintu's privacy practices:
* **Repository:** https://github.com/HuseynDeveloper/Mintu
* **Issue Tracker:** https://github.com/HuseynDeveloper/Mintu/issues
* **Contact:** Developer Support via GitHub Discussions or Repository Issues
