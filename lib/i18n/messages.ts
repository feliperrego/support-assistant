import type { Locale } from "./locale";
import { shellMessages, type ShellMessages } from "./shell-messages";

/**
 * The project's own strings (X-01 design §4.4). Project-owned: replace the defaults and add the
 * keys the project needs. A top-level key must not also be a shell key (see `messages` below).
 */
export type ProjectMessages = {
  empty: { title: string; subtitle: string };
  /** The suggested prompts; each button sends its text as the prompt. */
  prompts: readonly string[];
};

/** One locale's strings: the shell's and the project's. `{name}` marks where format() inserts a value. */
export type Messages = ShellMessages & ProjectMessages;

export const projectMessages: Record<Locale, ProjectMessages> = {
  en: {
    empty: {
      title: "Chat with the model",
      subtitle: "Starting point: replace this text, the prompts and the instructions.",
    },
    prompts: [
      "Explain streaming in one paragraph.",
      "What can you help me with?",
      "Write a haiku about testing.",
      "List three benefits of small projects.",
    ],
  },
  "pt-BR": {
    empty: {
      title: "Converse com o modelo",
      subtitle: "Ponto de partida: troque este texto, os prompts e as instruções.",
    },
    prompts: [
      "Explique streaming em um parágrafo.",
      "Em que você pode me ajudar?",
      "Escreva um haicai sobre testes.",
      "Liste três vantagens de projetos pequenos.",
    ],
  },
};

/**
 * Every visible and accessible interface string, in English and pt-BR. The shell and the project
 * share no top-level key: with one in common, the project's spread would replace the whole shell
 * object (X-01 design §4.4). messages.test.ts checks it. Pure and client-safe.
 */
export const messages: Record<Locale, Messages> = {
  en: { ...shellMessages.en, ...projectMessages.en },
  "pt-BR": { ...shellMessages["pt-BR"], ...projectMessages["pt-BR"] },
};
