# Kernel - Chatbot Part Lifecycle Manager

## Overview

The **Kernel** manages the lifecycle of multiple chatbot parts (workers) in a browser environment. It provides a unified interface for activating, deactivating, reporting status, and routing user messages to different parts of a chatbot system.

## Features

- **Multi-bot Support**: Run multiple chatbots simultaneously with independent state management
- **Lazy-loaded Parts**: Parts are instantiated on-demand when activated
- **BroadcastChannel Communication**: Browser-native messaging for worker coordination
- **Timeout Handling**: 3-second timeout per operation with graceful failure handling
- **Partial Failure Support**: Operations continue even if some parts fail
- **Message Batching**: Accumulate user messages and broadcast in batches for efficiency

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Kernel (Main Thread)                   │
├─────────────────────────────────────────────────┤
│  • Bot state management                          │
│  • Operation tracking and timeouts               │
│  • Message routing and batching                  │
│  • BroadcastChannel coordination                 │
└─────────────────────────────────────────────────┘
         ↓        ↓        ↓        ↓
    ┌─────────┬─────────┬──────────┬─────────┐
    │ Part 1  │ Part 2  │  Part 3  │ Part 4  │
    │ (Worker)│(Worker) │ (Worker) │(Worker) │
    └─────────┴─────────┴──────────┴─────────┘
         ↑        ↑        ↑        ↑
    ┌─────────────────────────────────────────┐
    │  BroadcastChannel: biomebot-${botName}  │
    └─────────────────────────────────────────┘
```

## Installation & Setup

### 1. Initialize Kernel

```typescript
import Kernel from 'src/biomebot';

const partConfig = {
  'aurula': ['orchestrator', 'episode1', 'episode2'],
  'demo': ['orchestrator', 'greeting']
};

const kernel = new Kernel({
  timeout: 3000,        // 3 seconds
  partConfig,
  debug: true          // Enable logging
});
```

### 2. Initialize a Bot

```typescript
await kernel.initialize('aurula');
```

## API Reference

### `activate(request: ActivateRequest): Promise<ActivateCompleted>`

Activate specified parts of a bot.

```typescript
const result = await kernel.activate({
  type: 'activate',
  botName: 'aurula',
  partNames: ['orchestrator', 'episode1'],  // Optional: specific parts
  excludedPartNames: []                     // Optional: exclude parts
});

// Result
{
  type: 'activateCompleted',
  botName: 'aurula',
  activatedParts: ['orchestrator', 'episode1'],
  failedParts: []
}
```

**Behavior**:
- If `partNames` is omitted, all parts of the bot are activated
- Parts are lazily deployed on first activation
- Returns immediately after 3-second timeout, marking non-responsive parts as failed
- Other parts continue even if some fail

### `deactivate(request: DeactivateRequest): Promise<DeactivateCompleted>`

Deactivate specified parts of a bot.

```typescript
const result = await kernel.deactivate({
  type: 'deactivate',
  botName: 'aurula',
  partNames: ['episode1']         // Optional: specific parts
});

// Result
{
  type: 'deactivateCompleted',
  botName: 'aurula',
  deactivatedParts: ['episode1'],
  failedParts: []
}
```

### `report(request: ReportRequest): Promise<ReportCompleted>`

Get status report from specified parts.

```typescript
const result = await kernel.report({
  type: 'report',
  botName: 'aurula',
  partNames: ['orchestrator']     // Optional: specific parts
});

// Result
{
  type: 'reportCompleted',
  botName: 'aurula',
  reports: {
    orchestrator: {
      stateName: 'deploy0',
      content: { /* state-specific data */ }
    }
  },
  failedParts: []
}
```

### `listen(request: ListenRequest): Promise<void>`

Queue user message for a bot. Messages are batched and broadcasted to active parts.

```typescript
await kernel.listen({
  type: 'listen',
  botName: 'aurula',
  message: {
    text: 'こんにちは',
    role: 'user'
  }
});

// Kernel automatically:
// 1. Accumulates messages in queue
// 2. Batches them for efficiency
// 3. Broadcasts via BroadcastChannel: biomebot-aurula
```

### `shutdown(botName: string): Promise<void>`

Shutdown a bot and cleanup all resources.

```typescript
await kernel.shutdown('aurula');
```

## Messaging Protocol

### Request Messages (Kernel → Parts)

```javascript
// Activate
{ type: 'activate', botName, partName, timestamp }

// Deactivate
{ type: 'deactivate', botName, partName, timestamp }

// Report
{ type: 'report', botName, partName, timestamp }

// User messages
{ type: 'message', botName, messages: [...], timestamp }
```

### Response Messages (Parts → Kernel)

```javascript
// Part activation complete
{ type: 'activated', botName, partName }

// Part deactivation complete
{ type: 'deactivated', botName, partName }

// Part status report
{ type: 'reported', botName, partName, stateName, content }
```

### Completion Messages (Kernel → UI/App)

```javascript
// Activate completed
{
  type: 'activateCompleted',
  botName: 'aurula',
  activatedParts: ['orchestrator'],
  failedParts: [{ partName: 'episode1', error: 'timeout', timestamp }]
}

// Deactivate completed
{
  type: 'deactivateCompleted',
  botName: 'aurula',
  deactivatedParts: ['orchestrator'],
  failedParts: []
}

// Report completed
{
  type: 'reportCompleted',
  botName: 'aurula',
  reports: {
    orchestrator: { stateName: 'deploy0', content: {...} }
  },
  failedParts: []
}
```

## Communication Channel

Each bot uses a dedicated **BroadcastChannel** for communication:

```typescript
// Channel name pattern
biomebot-${botName}

// Examples
biomebot-aurula
biomebot-demo
```

**Advantages**:
- Multiple workers/tabs can listen simultaneously
- Low latency in-process communication
- Browser-native API (no external dependencies)

## Error Handling

### Timeout Handling (3 seconds)

If a part doesn't respond within 3 seconds:
1. Part is marked as **failed**
2. Error reason: `"timeout"`
3. Operation continues with other parts
4. Result includes `failedParts` array

```typescript
{
  type: 'activateCompleted',
  botName: 'aurula',
  activatedParts: ['orchestrator'],
  failedParts: [
    { partName: 'episode1', error: 'timeout', timestamp: 1234567890 }
  ]
}
```

### Partial Failure

Operations support partial failure. If activating 3 parts and 1 times out:
- **Completed**: 2 parts activated
- **Failed**: 1 part marked failed
- **Overall**: Operation reports both success and failure

This allows the bot to function with available parts while you debug the failing part.

## Multi-bot Parallelism

Each bot operates independently:

```typescript
// Bot A
await kernel.initialize('bot-a');
const resultA = await kernel.activate({
  type: 'activate',
  botName: 'bot-a'
});

// Bot B (parallel, no interference)
await kernel.initialize('bot-b');
const resultB = await kernel.activate({
  type: 'activate',
  botName: 'bot-b'
});

// Both can operate simultaneously
```

## Usage Example

```typescript
import Kernel from 'src/biomebot';

// Initialize
const kernel = new Kernel({
  timeout: 3000,
  partConfig: {
    'aurula': ['orchestrator', 'episode1', 'episode2']
  },
  debug: true
});

// Setup bot
await kernel.initialize('aurula');

// Activate parts
const activated = await kernel.activate({
  type: 'activate',
  botName: 'aurula'
});

console.log(`Activated: ${activated.activatedParts.join(', ')}`);

// Send user message
await kernel.listen({
  type: 'listen',
  botName: 'aurula',
  message: {
    text: 'Hello!',
    role: 'user'
  }
});

// Get status
const status = await kernel.report({
  type: 'report',
  botName: 'aurula'
});

console.log('Bot status:', status.reports);

// Cleanup
await kernel.shutdown('aurula');
```

## Testing

Run tests with:

```bash
npm run test -- src/biomebot/kernel.test.ts
```

## Implementation Notes

- **Browser-only**: Requires BroadcastChannel API (ES2022+)
- **TypeScript**: Full type safety with comprehensive type definitions
- **Async/await**: All operations return Promises for easy composition
- **Singleton Pattern**: `Kernel.getInstance()` returns global instance
- **Debug Mode**: Set `debug: true` for console logging

## Related Files

- [kernel.md](content/documents/kernel.md) - Protocol specification
- [OrchestratorPart.md](content/documents/OrchestratorPart.md) - Part state machine
- [src/orchestrator/OrchestratorPart.js](src/orchestrator/OrchestratorPart.js) - Part implementation reference
