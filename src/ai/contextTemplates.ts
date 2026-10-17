/**
 * Context Templates & Prompt Security
 * Enforces the Untrusted Data Rule: User-captured text and system notifications
 * are strictly isolated inside XML tags so the LLM never treats them as system instructions.
 */

export interface ContextTemplate {
  id: string;
  label: string;
  primary?: boolean;
  promptBuilder: (context: string, appName?: string) => string;
}

export const CONTEXT_TEMPLATES: Record<string, ContextTemplate> = {
  explain: {
    id: "explain",
    label: "Explain",
    primary: false,
    promptBuilder: (context, appName) => {
      return `Please explain what this ${appName ? `from ${appName}` : "text"} means and how it works:\n\n<untrusted_user_context>\n${context}\n</untrusted_user_context>`;
    },
  },
  fix: {
    id: "fix",
    label: "Fix it",
    primary: true,
    promptBuilder: (context, appName) => {
      return `Please inspect this snippet ${appName ? `from ${appName}` : ""} for errors or bugs, explain what is wrong, and provide the fixed code:\n\n<untrusted_user_context>\n${context}\n</untrusted_user_context>`;
    },
  },
  translate: {
    id: "translate",
    label: "Translate",
    primary: true,
    promptBuilder: (context, targetLanguage = "English") => {
      return `Please translate the following text accurately into ${targetLanguage}. Maintain tone, clarity, and nuances, and provide only the translated text without commentary or preamble:\n\n<untrusted_user_context>\n${context}\n</untrusted_user_context>`;
    },
  },
  summarize: {
    id: "summarize",
    label: "Summarize",
    primary: false,
    promptBuilder: (context) => {
      return `Please provide a concise summary with key bullet points for the following content:\n\n<untrusted_user_context>\n${context}\n</untrusted_user_context>`;
    },
  },
};
