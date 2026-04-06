# @tipstream/sdk

A security-focused SDK for TipStream with built-in metrics collection and NPM download tracking.

## Features

- 🔒 **Security-First Design** - Encryption, request signing, input validation
- 📊 **Metrics Collection** - Track SDK usage, NPM downloads, and analytics
- 🚀 **TypeScript Native** - Full type safety and IntelliSense support
- 📦 **Modular Architecture** - Use only what you need

## Packages

| Package | Description |
|---------|-------------|
| `@tipstream/sdk-core` | Core SDK client and API handlers |
| `@tipstream/sdk-security` | Security utilities (encryption, signing, validation) |
| `@tipstream/sdk-metrics` | Metrics collection and NPM download tracking |

## Quick Start

```bash
npm install @tipstream/sdk-core
```

```typescript
import { TipStreamClient } from '@tipstream/sdk-core';

const client = new TipStreamClient({
  apiKey: process.env.TIPSTREAM_API_KEY,
});

// Use the SDK
const result = await client.request('/endpoint');
```

## Installation

### Core SDK
```bash
npm install @tipstream/sdk-core
```

### With Security Features
```bash
npm install @tipstream/sdk-core @tipstream/sdk-security
```

### Full Suite
```bash
npm install @tipstream/sdk-core @tipstream/sdk-security @tipstream/sdk-metrics
```

## Documentation

- [Getting Started](./docs/GETTING_STARTED.md)
- [API Reference](./docs/API.md)
- [Security Guide](./docs/SECURITY.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Metrics Guide](./docs/METRICS.md)

## Security

Please see [SECURITY.md](./SECURITY.md) for our security policy and how to report vulnerabilities.

## Contributing

Please see [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for contribution guidelines.

## License

MIT © TipStream
