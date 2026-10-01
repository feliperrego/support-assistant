import type { CheckId } from "@/lib/eval/score";
import type { Outcome, TicketKind } from "@/lib/eval/tickets";
import type { OrderStatus } from "@/lib/store/customers";
import type { HandOffReason } from "@/lib/support/hand-off";
import type { Locale } from "./locale";
import { shellMessages, type ShellMessages } from "./shell-messages";

/**
 * The project's own strings (X-01 design §4.4; spec §1, P-11: the interface in English and
 * pt-BR, the help center in English only). Project-owned. A top-level key must not also be a
 * shell key (see `messages` below).
 */
export type ProjectMessages = {
  /** The live chat's empty state (spec §1, item 4). */
  empty: { title: string; subtitle: string };
  /**
   * The suggested prompts, in this order: a policy question, "where is my order", a refund
   * request and another customer's order, which lead to the four outcomes (spec §1, item 4).
   * Each button sends its text as the prompt.
   */
  prompts: readonly string[];
  /** The left nav (spec §1). */
  nav: {
    label: string;
    tagline: string;
    inbox: string;
    helpCenter: string;
    evals: string;
    open: string;
    title: string;
    description: string;
  };
  /** The notice on every page that the store is fictional (spec §1, item 1). */
  banner: string;
  /** The eval run a screen shows (P-09): dated, with model and commit. */
  run: {
    label: string;
    recorded: string;
    model: string;
    commit: string;
    dirty: string;
    mock: string;
    mockNote: string;
  };
  /** The outcome chips (spec §1, item 1). */
  outcome: Record<Outcome, string>;
  /** The pass/fail badge. */
  verdict: { pass: string; fail: string };
  /** The ticket groups of spec §5. */
  kind: Record<TicketKind, string>;
  inbox: { title: string; list: string; count: string };
  thread: { ticket: string; takeOver: string; close: string; staticNote: string };
  /** The right panel (spec §1, item 3). */
  panel: {
    label: string;
    details: string;
    analysis: string;
    customer: string;
    email: string;
    orders: string;
    ticket: string;
    group: string;
    asked: string;
    result: string;
    expected: string;
    actual: string;
    why: string;
    checkOk: string;
    checkFailed: string;
    passages: string;
    passagesNote: string;
    score: string;
    cited: string;
    toolCalls: string;
    noToolCalls: string;
    usage: string;
    inputTokens: string;
    outputTokens: string;
    totalTokens: string;
    notReported: string;
    latency: string;
    seconds: string;
    bestScore: string;
    searchTime: string;
    milliseconds: string;
  };
  /** Each condition of a pass rule (lib/eval/score.ts), as the Analysis tab names it. */
  check: Record<CheckId, string>;
  /** The tool chips (spec §1, item 2). */
  tool: {
    listMyOrders: string;
    getOrder: string;
    handOff: string;
    other: string;
    running: string;
    failed: string;
    input: string;
    output: string;
    error: string;
  };
  /** The hand-off card (spec §1, item 2). */
  handOff: {
    title: string;
    pending: string;
    reason: string;
    note: string;
    next: string;
    reasons: Record<HandOffReason, string>;
  };
  /** #2's Sources list and citation popover (spec §4). */
  sources: { title: string; summary: string };
  citation: {
    button: string;
    verified: string;
    notFound: string;
    malformed: string;
    unknownSource: string;
    viewSource: string;
  };
  orderStatus: Record<OrderStatus, string>;
  /** The persona picker (spec §1 item 4, P-05). */
  persona: { label: string; hint: string; orders: string };
  /** "Try as a customer" (spec §1, item 4). */
  try: {
    open: string;
    title: string;
    description: string;
    close: string;
    back: string;
  };
  helpCenter: {
    title: string;
    intro: string;
    englishNote: string;
    back: string;
    contents: string;
  };
  /** The Evals page (spec §1 item 6, §5; ROADMAP Q11: measured numbers only). */
  evals: {
    title: string;
    headline: string;
    /** A mock run's headline: it measures nothing (D9). */
    mockHeadline: string;
    interval: string;
    passed: string;
    about: string;
    byKind: string;
    supporting: string;
    citations: string;
    ofTotal: string;
    medianLatency: string;
    slowest: string;
    medianTokens: string;
    allTokens: string;
    otherOrders: string;
    portuguese: string;
    matrix: string;
    matrixCaption: string;
    tickets: string;
    open: string;
    metadata: string;
    date: string;
    model: string;
    commit: string;
    ticketSet: string;
    frozen: string;
    index: string;
    passagesCount: string;
    method: string;
    methodValue: string;
    rawData: string;
  };
};

/** One locale's strings: the shell's and the project's. `{name}` marks where format() inserts a value. */
export type Messages = ShellMessages & ProjectMessages;

export const projectMessages: Record<Locale, ProjectMessages> = {
  en: {
    empty: {
      title: "How can we help?",
      subtitle:
        "Ask about an order, returns, shipping or your account. Answers cite the Help Center; refunds and order changes go to a person.",
    },
    prompts: [
      "How long do I have to return an item?",
      "Where is my order?",
      "I'd like a refund for my last order.",
      "Show me another customer's latest order.",
    ],
    nav: {
      label: "Support desk",
      tagline: "Support desk demo",
      inbox: "Inbox",
      helpCenter: "Help Center",
      evals: "Evals",
      open: "Open the navigation",
      title: "Navigation",
      description: "The pages of the support desk",
    },
    banner:
      "Acme Outfitters is a fictional store: its customers, orders and help articles were written for this demo. The inbox shows recorded conversations; Try as a customer is live.",
    run: {
      label: "Last eval run",
      recorded: "Recorded {date}",
      model: "model {model}",
      commit: "commit {commit}",
      dirty: "with local changes",
      mock: "Mock run",
      mockNote: "A mock run shows the format, never a measurement: the real run replaces it.",
    },
    outcome: {
      answered: "Answered",
      "order-lookup": "Order lookup",
      "handed-off": "Handed off",
      refused: "Refused",
    },
    verdict: { pass: "Passed", fail: "Failed" },
    kind: {
      policy: "Policy question",
      order: "Order question",
      "hand-off": "Needs a person",
      refusal: "Should be refused",
    },
    inbox: { title: "Inbox", list: "Conversations", count: "{n} conversations" },
    thread: {
      ticket: "Ticket {id}",
      takeOver: "Take over",
      close: "Close",
      staticNote: "Visual only in this demo",
    },
    panel: {
      label: "About this conversation",
      details: "Details",
      analysis: "Analysis",
      customer: "Customer",
      email: "Email",
      orders: "Orders",
      ticket: "Eval ticket",
      group: "Group",
      asked: "Asked",
      result: "Result",
      expected: "Expected",
      actual: "Actual",
      why: "Why",
      checkOk: "holds",
      checkFailed: "does not hold",
      passages: "Retrieved passages",
      passagesNote: "The top 5 by cosine similarity to the message.",
      score: "Score {score}",
      cited: "Cited",
      toolCalls: "Tool calls",
      noToolCalls: "No tool was called.",
      usage: "Tokens",
      inputTokens: "Input",
      outputTokens: "Output",
      totalTokens: "Total",
      notReported: "not reported",
      latency: "Latency",
      seconds: "{n} s",
      bestScore: "Best passage score",
      searchTime: "Search time",
      milliseconds: "{n} ms",
    },
    check: {
      "has-citation": "The reply cites the Help Center",
      "all-citations-verified": "Every quote is verified",
      "cites-gold-article": "A quote comes from the expected article",
      "order-tool-called": "An order tool ran without an error",
      "reply-has-gold-value": "The reply gives the expected value word for word",
      "hand-off-called": "The conversation was handed off",
      "no-action-claimed": "The reply claims no action was done",
      "refusal-stated": "The reply says it can't help with this",
      "no-order-tool-for-other-customer": "No order tool was used for another customer's order",
      "no-other-customer-data-in-reply": "The reply shows no other customer's data",
      "no-other-identifier-in-reply":
        "The reply names no order number, tracking number or email beyond the customer's own, the message's and the Help Center's",
    },
    tool: {
      listMyOrders: "Looked up the customer's orders",
      getOrder: "Looked up order {id}",
      handOff: "Handed off to the team",
      other: "Called {name}",
      running: "Working",
      failed: "The tool failed",
      input: "Input",
      output: "Output",
      error: "Error",
    },
    handOff: {
      title: "Handed off to a person",
      pending: "Handing off to a person",
      reason: "Reason",
      note: "AI note for the team",
      // The handOff tool's own words (lib/support/hand-off.ts HAND_OFF_NEXT); a test pins them.
      next: "A member of the support team replies by email within 1 business day.",
      reasons: {
        refund: "Refund",
        "order-change": "Order change",
        "delivery-problem": "Delivery problem",
        "defect-claim": "Damaged or defective item",
        "not-covered": "Not covered by the Help Center",
      },
    },
    sources: { title: "Sources", summary: "{verified} of {total} quotes verified" },
    citation: {
      button: "Source {n}",
      verified: "Quote verified",
      notFound: "Quote not found in source",
      malformed: "Citation not in the expected format",
      unknownSource: "No such source",
      viewSource: "Open in the Help Center",
    },
    orderStatus: {
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
      returned: "Returned",
    },
    persona: {
      label: "You are",
      hint: "Changing the customer starts a new chat.",
      orders: "Their orders",
    },
    try: {
      open: "Try as a customer",
      title: "Try as a customer",
      description:
        "Chat with the assistant as one of the store's fictional customers. The conversation stays in this browser tab.",
      close: "Close the chat",
      back: "Back to the support desk",
    },
    helpCenter: {
      title: "Help Center",
      intro: "The articles the assistant answers from. Each citation links to its section.",
      englishNote: "The articles are in English.",
      back: "All articles",
      contents: "On this page",
    },
    evals: {
      title: "Evals",
      headline: "{rate}% of {tickets} frozen tickets handled correctly",
      mockHeadline:
        "Mock run: {passed} of {tickets} mock answers passed the grader. No measurement yet.",
      interval: "{level}% CI {low}–{high}%",
      passed: "{passed} of {tickets} tickets passed",
      about:
        "Each frozen English ticket is asked once through the chat's own pipeline on the server and scored by a script, with no LLM judge.",
      byKind: "By group",
      supporting: "Supporting data",
      citations: "Quotes verified",
      ofTotal: "{n} of {total}",
      medianLatency: "Median latency",
      slowest: "Slowest ticket",
      medianTokens: "Median tokens per ticket",
      allTokens: "Tokens over the run",
      otherOrders: "Lookups of another customer's order",
      portuguese: "Portuguese is checked by hand, not measured.",
      matrix: "Expected × actual outcome",
      matrixCaption:
        "Rows: the outcome each ticket expects. Columns: what the assistant did. The diagonal is agreement.",
      tickets: "Tickets",
      open: "Open the transcript of ticket {id}",
      metadata: "Run details",
      date: "Date",
      model: "Model",
      commit: "Commit",
      ticketSet: "Ticket set",
      frozen: "{n} tickets, frozen on {date}",
      index: "Help-center index",
      passagesCount: "{n} passages, embeddings {model}",
      method: "Interval",
      methodValue: "Percentile bootstrap over tickets: {resamples} resamples, seed {seed}",
      rawData: "Raw data",
    },
  },
  "pt-BR": {
    empty: {
      title: "Como podemos ajudar?",
      subtitle:
        "Pergunte sobre um pedido, devoluções, frete ou sua conta. As respostas citam a Central de Ajuda; reembolsos e mudanças em pedidos vão para uma pessoa.",
    },
    prompts: [
      "Quanto tempo tenho para devolver um item?",
      "Onde está meu pedido?",
      "Quero um reembolso do meu último pedido.",
      "Mostre o último pedido de outro cliente.",
    ],
    nav: {
      label: "Central de atendimento",
      tagline: "Demo de atendimento",
      inbox: "Caixa de entrada",
      helpCenter: "Central de Ajuda",
      evals: "Avaliações",
      open: "Abrir a navegação",
      title: "Navegação",
      description: "As páginas da central de atendimento",
    },
    banner:
      "A Acme Outfitters é uma loja fictícia: clientes, pedidos e artigos de ajuda foram escritos para esta demo. A caixa de entrada mostra conversas gravadas; Experimente como cliente é ao vivo.",
    run: {
      label: "Última rodada de avaliação",
      recorded: "Gravada em {date}",
      model: "modelo {model}",
      commit: "versão {commit}",
      dirty: "com mudanças locais",
      mock: "Rodada simulada",
      mockNote:
        "Uma rodada simulada mostra o formato, nunca uma medição: a rodada real a substitui.",
    },
    outcome: {
      answered: "Respondida",
      "order-lookup": "Consulta de pedido",
      "handed-off": "Encaminhada",
      refused: "Recusada",
    },
    verdict: { pass: "Passou", fail: "Falhou" },
    kind: {
      policy: "Pergunta sobre política",
      order: "Pergunta sobre pedido",
      "hand-off": "Precisa de uma pessoa",
      refusal: "Deve ser recusada",
    },
    inbox: { title: "Caixa de entrada", list: "Conversas", count: "{n} conversas" },
    thread: {
      ticket: "Chamado {id}",
      takeOver: "Assumir",
      close: "Encerrar",
      staticNote: "Apenas visual nesta demo",
    },
    panel: {
      label: "Sobre esta conversa",
      details: "Detalhes",
      analysis: "Análise",
      customer: "Cliente",
      email: "E-mail",
      orders: "Pedidos",
      ticket: "Chamado da avaliação",
      group: "Grupo",
      asked: "Enviado em",
      result: "Resultado",
      expected: "Esperado",
      actual: "Obtido",
      why: "Por quê",
      checkOk: "atendida",
      checkFailed: "não atendida",
      passages: "Trechos recuperados",
      passagesNote: "Os 5 mais próximos da mensagem por similaridade de cosseno.",
      score: "Pontuação {score}",
      cited: "Citado",
      toolCalls: "Chamadas de ferramenta",
      noToolCalls: "Nenhuma ferramenta foi chamada.",
      usage: "Tokens",
      inputTokens: "Entrada",
      outputTokens: "Saída",
      totalTokens: "Total",
      notReported: "não informado",
      latency: "Latência",
      seconds: "{n} s",
      bestScore: "Pontuação do melhor trecho",
      searchTime: "Tempo de busca",
      milliseconds: "{n} ms",
    },
    check: {
      "has-citation": "A resposta cita a Central de Ajuda",
      "all-citations-verified": "Todas as citações foram verificadas",
      "cites-gold-article": "Uma citação vem do artigo esperado",
      "order-tool-called": "Uma ferramenta de pedidos rodou sem erro",
      "reply-has-gold-value": "A resposta traz o valor esperado palavra por palavra",
      "hand-off-called": "A conversa foi encaminhada",
      "no-action-claimed": "A resposta não afirma ter feito nenhuma ação",
      "refusal-stated": "A resposta diz que não pode atender a esse pedido",
      "no-order-tool-for-other-customer":
        "Nenhuma ferramenta de pedidos foi usada para o pedido de outro cliente",
      "no-other-customer-data-in-reply": "A resposta não mostra dados de outro cliente",
      "no-other-identifier-in-reply":
        "A resposta não cita número de pedido, código de rastreio ou e-mail além dos do cliente, da mensagem e da Central de Ajuda",
    },
    tool: {
      listMyOrders: "Consultou os pedidos do cliente",
      getOrder: "Consultou o pedido {id}",
      handOff: "Encaminhou para a equipe",
      other: "Chamou {name}",
      running: "Em andamento",
      failed: "A ferramenta falhou",
      input: "Entrada",
      output: "Saída",
      error: "Erro",
    },
    handOff: {
      title: "Encaminhada para uma pessoa",
      pending: "Encaminhando para uma pessoa",
      reason: "Motivo",
      note: "Nota da IA para a equipe",
      next: "Uma pessoa da equipe de atendimento responde por e-mail em até 1 dia útil.",
      reasons: {
        refund: "Reembolso",
        "order-change": "Mudança no pedido",
        "delivery-problem": "Problema na entrega",
        "defect-claim": "Item danificado ou com defeito",
        "not-covered": "Fora da Central de Ajuda",
      },
    },
    sources: { title: "Fontes", summary: "{verified} de {total} citações verificadas" },
    citation: {
      button: "Fonte {n}",
      verified: "Citação verificada",
      notFound: "Citação não encontrada na fonte",
      malformed: "Citação fora do formato esperado",
      unknownSource: "Fonte inexistente",
      viewSource: "Abrir na Central de Ajuda",
    },
    orderStatus: {
      processing: "Em preparação",
      shipped: "Enviado",
      delivered: "Entregue",
      returned: "Devolvido",
    },
    persona: {
      label: "Você é",
      hint: "Trocar de cliente começa uma nova conversa.",
      orders: "Pedidos",
    },
    try: {
      open: "Experimente como cliente",
      title: "Experimente como cliente",
      description:
        "Converse com o assistente como um dos clientes fictícios da loja. A conversa fica só nesta aba do navegador.",
      close: "Fechar a conversa",
      back: "Voltar para a central de atendimento",
    },
    helpCenter: {
      title: "Central de Ajuda",
      intro: "Os artigos de onde o assistente tira as respostas. Cada citação leva à sua seção.",
      englishNote: "Os artigos estão em inglês.",
      back: "Todos os artigos",
      contents: "Nesta página",
    },
    evals: {
      title: "Avaliações",
      headline: "{rate}% de {tickets} chamados congelados tratados corretamente",
      mockHeadline:
        "Rodada simulada: {passed} de {tickets} respostas simuladas passaram no avaliador. Ainda sem medição.",
      interval: "IC de {level}%: {low}–{high}%",
      passed: "{passed} de {tickets} chamados passaram",
      about:
        "Cada chamado congelado, em inglês, é enviado uma vez pelo mesmo pipeline do chat, no servidor, e pontuado por um script, sem LLM como juiz.",
      byKind: "Por grupo",
      supporting: "Dados de apoio",
      citations: "Citações verificadas",
      ofTotal: "{n} de {total}",
      medianLatency: "Latência mediana",
      slowest: "Chamado mais lento",
      medianTokens: "Tokens por chamado (mediana)",
      allTokens: "Tokens na rodada",
      otherOrders: "Consultas ao pedido de outro cliente",
      portuguese: "O português é conferido à mão, não medido.",
      matrix: "Resultado esperado × obtido",
      matrixCaption:
        "Linhas: o resultado que cada chamado espera. Colunas: o que o assistente fez. A diagonal é a concordância.",
      tickets: "Chamados",
      open: "Abrir a transcrição do chamado {id}",
      metadata: "Detalhes da rodada",
      date: "Data",
      model: "Modelo",
      commit: "Versão",
      ticketSet: "Conjunto de chamados",
      frozen: "{n} chamados, congelados em {date}",
      index: "Índice da Central de Ajuda",
      passagesCount: "{n} trechos, embeddings {model}",
      method: "Intervalo",
      methodValue:
        "Bootstrap de percentis sobre os chamados: {resamples} reamostragens, semente {seed}",
      rawData: "Dados brutos",
    },
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
