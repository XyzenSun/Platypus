export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface Tool {
  name: string;
  // Provider-specific tool definition passed through as-is
  definition: unknown;
}

export interface ChatOptions {
  tools?: Tool[];
  signal?: AbortSignal;
  retryDelays?: number[];
}

export interface ChatResponse {
  content: string;
  // Tool calls the model wants to invoke, if any
  toolCalls?: { name: string; args: unknown }[];
}

export interface AIClient {
  readonly id: string;
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
}
