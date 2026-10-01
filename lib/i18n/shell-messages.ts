import type { Locale } from "./locale";

/**
 * One locale's shell strings (X-01 design §4.4): the text of the header, composer, conversation,
 * banners, screen-reader status line and footer. `{n}` marks where format() inserts a number.
 * Shell components read only these keys; project text reaches them through props.
 */
export type ShellMessages = {
  header: { mockBadge: string; newChat: string; language: string };
  composer: {
    label: string;
    placeholder: string;
    /** Replaces the placeholder once the conversation reaches its message cap. */
    capPlaceholder: string;
    send: string;
    stop: string;
  };
  list: {
    label: string;
    stopped: string;
    cutOff: string;
    regenerate: string;
    /** Ends with the middle dot; the component adds a space before Regenerate. */
    stoppedBefore: string;
  };
  chat: { jump: string; retry: string; rateNote: string };
  errors: { generic: string; limit: string };
  status: { complete: string; stopped: string; failed: string };
  footer: { builtBy: string; source: string };
};

/**
 * The shell's approved text, in English and pt-BR (X-01 design §4.4). messages.test.ts pins it,
 * so a rewording is a deliberate change to the shell. Pure and client-safe.
 */
export const shellMessages: Record<Locale, ShellMessages> = {
  en: {
    header: { mockBadge: "Mock model", newChat: "New chat", language: "Language" },
    composer: {
      label: "Message",
      placeholder: "Send a message",
      capPlaceholder: "Conversation limit reached. Start a new chat.",
      send: "Send message",
      stop: "Stop generating",
    },
    list: {
      label: "Conversation",
      stopped: "Stopped",
      cutOff: "Cut at demo length limit",
      regenerate: "Regenerate",
      stoppedBefore: "Stopped before a response ·",
    },
    chat: {
      jump: "Jump to latest",
      retry: "Retry",
      rateNote: "{n} messages/hour per visitor; regenerations count",
    },
    errors: {
      generic: "Couldn't get a response. Check your connection and try again.",
      limit: "Demo limit reached: {n} messages per hour. Try again later.",
    },
    status: {
      complete: "Response complete",
      stopped: "Response stopped",
      failed: "Response failed",
    },
    footer: { builtBy: "Built by", source: "Source on GitHub" },
  },
  "pt-BR": {
    header: { mockBadge: "Modelo simulado", newChat: "Nova conversa", language: "Idioma" },
    composer: {
      label: "Mensagem",
      placeholder: "Envie uma mensagem",
      capPlaceholder: "Limite da conversa atingido. Comece uma nova conversa.",
      send: "Enviar mensagem",
      stop: "Parar geração",
    },
    list: {
      label: "Conversa",
      stopped: "Interrompida",
      cutOff: "Cortada no limite de tamanho da demo",
      regenerate: "Gerar novamente",
      stoppedBefore: "Interrompida antes da resposta ·",
    },
    chat: {
      jump: "Ir para o fim",
      retry: "Tentar de novo",
      rateNote: "{n} mensagens/hora por visitante; regenerações contam",
    },
    errors: {
      generic: "Não foi possível obter uma resposta. Verifique sua conexão e tente de novo.",
      limit: "Limite da demo atingido: {n} mensagens por hora. Tente mais tarde.",
    },
    status: {
      complete: "Resposta concluída",
      stopped: "Resposta interrompida",
      failed: "Falha na resposta",
    },
    footer: { builtBy: "Feito por", source: "Código no GitHub" },
  },
};
