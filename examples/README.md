# TipStream SDK Examples

This directory contains working examples demonstrating the TipStream SDK functionality.

## Running Examples

All examples can be run using `npx tsx`:

```bash
# Quick functionality test
npx tsx examples/quick-test.ts
```

## Available Examples

### quick-test.ts 
A simple working test that demonstrates:
- Encryption/Decryption with AES-256-GCM
- Metrics collection and reporting

**Status**: Fully functional and tested

These show comprehensive usage patterns but require actual API endpoints:### Reference Examples 
- `basic-usage.ts` - HTTP client usage
- `security-demo.ts` - Security features
- `tipstream-integration.ts` - Full integration
- `metrics-tracking.ts` - Complete metrics setup

**Note**: Reference examples demonstrate API patterns but may need modifications to match the current implementation.

## Requirements

- Node.js 18+
- Built SDK packages (run `npm run build` from root)
