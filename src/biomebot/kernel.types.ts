/**
 * Type definitions for Kernel messaging and state management
 */

// Message types
export type KernelMessageType =
  | 'activate'
  | 'deactivate'
  | 'report'
  | 'listen'
  | 'activated'
  | 'deactivated'
  | 'reported'
  | 'activateCompleted'
  | 'deactivateCompleted'
  | 'reportCompleted'
  | 'message';

// Base message structure
export interface BaseMessage {
  type: KernelMessageType;
  botName: string;
}

// Request messages
export interface ActivateRequest extends BaseMessage {
  type: 'activate';
  partNames?: string[];
  excludedPartNames?: string[];
}

export interface DeactivateRequest extends BaseMessage {
  type: 'deactivate';
  partNames?: string[];
  excludedPartNames?: string[];
}

export interface ReportRequest extends BaseMessage {
  type: 'report';
  partNames?: string[];
}

export interface ListenRequest extends BaseMessage {
  type: 'listen';
  message: ChatMessage;
}

// Part response messages
export interface ActivatedResponse extends BaseMessage {
  type: 'activated';
  partName: string;
}

export interface DeactivatedResponse extends BaseMessage {
  type: 'deactivated';
  partName: string;
}

export interface ReportedResponse extends BaseMessage {
  type: 'reported';
  partName: string;
  stateName?: string;
  content?: unknown;
  [key: string]: unknown;
}

// Completion messages
export interface FailedPart {
  partName: string;
  error: string;
  timestamp?: number;
}

export interface ActivateCompleted extends BaseMessage {
  type: 'activateCompleted';
  activatedParts: string[];
  failedParts: FailedPart[];
}

export interface DeactivateCompleted extends BaseMessage {
  type: 'deactivateCompleted';
  deactivatedParts: string[];
  failedParts: FailedPart[];
}

export interface ReportCompleted extends BaseMessage {
  type: 'reportCompleted';
  reports: Record<string, unknown>;
  failedParts: FailedPart[];
}

// Broadcasting message
export interface BroadcastMessage extends BaseMessage {
  type: 'message';
  messages: ChatMessage[];
}

// Chat message
export interface ChatMessage {
  text: string;
  role: 'user' | 'bot';
  [key: string]: unknown;
}

// Union types for easier handling
export type KernelRequest =
  | ActivateRequest
  | DeactivateRequest
  | ReportRequest
  | ListenRequest;

export type KernelCompletion =
  | ActivateCompleted
  | DeactivateCompleted
  | ReportCompleted;

export type PartResponse =
  | ActivatedResponse
  | DeactivatedResponse
  | ReportedResponse;

export type KernelMessage = KernelRequest | PartResponse | KernelCompletion | BroadcastMessage;

// Part configuration from next.config.js
export interface PartConfig {
  [botName: string]: string[];
}

// Internal part state
export type PartState = 'idle' | 'deploying' | 'active' | 'deactivating' | 'deactivated' | 'failed';

export interface PartInstance {
  id: string;
  botName: string;
  state: PartState;
  worker?: Worker | SharedWorker;
  workerChannel?: MessagePort; // Worker専用channel（Kernel↔Part）
  deployedAt?: number;
  lastMessageAt?: number;
  errors: string[];
}

// Internal bot state
export interface BotState {
  botName: string;
  parts: Map<string, PartInstance>;
  broadcastChannel?: BroadcastChannel;
  messageQueue: ChatMessage[];
  isProcessing: boolean;
  activePartCount: number;
}

// Kernel options
export interface KernelOptions {
  timeout?: number; // milliseconds, default 3000
  partConfig?: PartConfig;
  debug?: boolean;
}

// Response callback type
export type ResponseCallback = (
  message: PartResponse | KernelCompletion | BroadcastMessage
) => void;
