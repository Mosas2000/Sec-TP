#!/usr/bin/env node

/**
 * Metrics Collection Script
 * Fetches NPM download statistics for @tipstream/sdk packages
 */

import { NpmTracker } from '../packages/metrics/src/npm-tracker.js';
import { MetricsPersistence } from '../packages/metrics/src/persistence.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const PACKAGES = [
  '@tipstream/sdk-core',
  '@tipstream/sdk-security',
  '@tipstream/sdk-metrics'
];

async function collectMetrics() {
  const outputDir = process.env.METRICS_OUTPUT_DIR || 'metrics-data';
  const specificPackage = process.env.SPECIFIC_PACKAGE;
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const packagesToTrack = specificPackage 
    ? [specificPackage] 
    : PACKAGES;

  const tracker = new NpmTracker({
    packages: packagesToTrack,
    cacheDir: join(outputDir, 'cache'),
    cacheTTL: 3600000 // 1 hour
  });

  const persistence = new MetricsPersistence({
    filePath: join(outputDir, 'npm-downloads.json'),
    autoSave: false
  });

  console.log(`Collecting metrics for ${packagesToTrack.length} package(s)...`);
  console.log(`Output directory: ${outputDir}`);
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    packages: {}
  };

  for (const packageName of packagesToTrack) {
    console.log(`Fetching data for ${packageName}...`);
    
    try {
      // Get download stats
      const downloads = await tracker.getDownloads(packageName);
      const weeklyDownloads = await tracker.getDownloads(packageName, 'last-week');
      const monthlyDownloads = await tracker.getDownloads(packageName, 'last-month');
      
      // Get package info
      const packageInfo = await tracker.getPackageInfo(packageName);
      
      // Get trends
      const trends = await tracker.getDownloadTrends(packageName, 30);

      results.packages[packageName] = {
        downloads: {
          total: downloads,
          weekly: weeklyDownloads,
          monthly: monthlyDownloads
        },
        version: packageInfo?.version || 'unknown',
        trends: trends,
        lastUpdated: new Date().toISOString()
      };

      // Store in persistence layer
      persistence.set(`downloads.${packageName.replace(/[/@]/g, '_')}.total`, downloads);
      persistence.set(`downloads.${packageName.replace(/[/@]/g, '_')}.weekly`, weeklyDownloads);
      persistence.set(`downloads.${packageName.replace(/[/@]/g, '_')}.monthly`, monthlyDownloads);
      persistence.set(`downloads.${packageName.replace(/[/@]/g, '_')}.timestamp`, new Date().toISOString());

      console.log(`  Total: ${downloads}`);
      console.log(`  Weekly: ${weeklyDownloads}`);
      console.log(`  Monthly: ${monthlyDownloads}`);
      console.log('');
    } catch (error) {
      console.error(`  Error fetching ${packageName}: ${error.message}`);
      results.packages[packageName] = {
        error: error.message,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // Save results
  const outputPath = join(outputDir, `metrics-${new Date().toISOString().split('T')[0]}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${outputPath}`);

  // Save persistence data
  await persistence.save();
  console.log(`Persistence data saved`);

  // Generate summary
  const summary = {
    collectedAt: results.timestamp,
    packageCount: Object.keys(results.packages).length,
    totalDownloads: Object.values(results.packages)
      .filter(p => !p.error)
      .reduce((sum, p) => sum + (p.downloads?.total || 0), 0),
    errors: Object.entries(results.packages)
      .filter(([, p]) => p.error)
      .map(([name, p]) => ({ package: name, error: p.error }))
  };

  writeFileSync(
    join(outputDir, 'summary.json'), 
    JSON.stringify(summary, null, 2)
  );
  console.log('');
  console.log('Summary:');
  console.log(`  Packages tracked: ${summary.packageCount}`);
  console.log(`  Total downloads: ${summary.totalDownloads}`);
  console.log(`  Errors: ${summary.errors.length}`);
}

collectMetrics().catch(error => {
  console.error('Metrics collection failed:', error);
  process.exit(1);
});
