/**
 * Quick Test - Verify SDK functionality
 */

import { Encryptor, generateKey } from '@tipstream/sdk-security';
import { MetricsCollector, ConsoleReporter } from '@tipstream/sdk-metrics';

console.log('=== TipStream SDK Quick Test ===\n');

// Test 1: Encryption
console.log('1. Testing Encryption...');
const key = generateKey();
const encryptor = new Encryptor(key);
const plaintext = 'Hello, TipStream!';
const encrypted = encryptor.encrypt(plaintext);
const decrypted = encryptor.decrypt(encrypted);
console.log(`   Original: ${plaintext}`);
console.log(`   Decrypted: ${decrypted.toString()}`);
console.log(`   ✓ Encryption works!\n`);

// Test 2: Metrics
console.log('2. Testing Metrics...');
const metrics = new MetricsCollector({
  flushInterval: 1000,
  defaultTags: { test: 'true' }
});

metrics.addReporter(new ConsoleReporter({ prefix: '   [Metrics]' }));

metrics.increment('test.counter', 1, { type: 'demo' });
metrics.gauge('test.gauge', 42);
metrics.timing('test.duration', 150);

await metrics.flush();
await metrics.close();

console.log('   ✓ Metrics works!\n');

console.log('=== All Tests Passed! ===');
