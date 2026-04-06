#!/usr/bin/env node

/**
 * Metrics Report Generator
 * Generates summary reports from collected metrics data
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

function generateReport() {
  const inputDir = process.env.METRICS_INPUT_DIR || 'metrics-data';
  
  if (!existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  // Read all daily metrics files
  const files = readdirSync(inputDir)
    .filter(f => f.startsWith('metrics-') && f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.log('No metrics files found');
    return;
  }

  console.log(`Found ${files.length} metrics file(s)`);

  // Parse all metrics
  const allMetrics = files.map(file => {
    const content = readFileSync(join(inputDir, file), 'utf-8');
    return JSON.parse(content);
  });

  // Get the most recent metrics
  const latest = allMetrics[allMetrics.length - 1];
  
  // Calculate trends over available data
  const trends = {};
  
  for (const [packageName, data] of Object.entries(latest.packages)) {
    if (data.error) continue;

    const packageHistory = allMetrics
      .map(m => m.packages[packageName])
      .filter(p => p && !p.error);

    if (packageHistory.length < 2) {
      trends[packageName] = { trend: 'insufficient_data' };
      continue;
    }

    const first = packageHistory[0];
    const last = packageHistory[packageHistory.length - 1];
    
    const downloadGrowth = last.downloads.total - first.downloads.total;
    const percentGrowth = first.downloads.total > 0 
      ? ((downloadGrowth / first.downloads.total) * 100).toFixed(2)
      : 'N/A';

    trends[packageName] = {
      downloadGrowth,
      percentGrowth: `${percentGrowth}%`,
      dataPoints: packageHistory.length,
      trend: downloadGrowth > 0 ? 'up' : downloadGrowth < 0 ? 'down' : 'stable'
    };
  }

  // Generate report
  const report = {
    generatedAt: new Date().toISOString(),
    period: {
      start: allMetrics[0].timestamp,
      end: latest.timestamp,
      daysOfData: files.length
    },
    current: {
      packages: Object.entries(latest.packages)
        .filter(([, data]) => !data.error)
        .map(([name, data]) => ({
          name,
          downloads: data.downloads,
          version: data.version
        }))
    },
    trends,
    summary: {
      totalPackages: Object.keys(latest.packages).filter(p => !latest.packages[p].error).length,
      totalDownloads: Object.values(latest.packages)
        .filter(p => !p.error)
        .reduce((sum, p) => sum + (p.downloads?.total || 0), 0),
      totalWeeklyDownloads: Object.values(latest.packages)
        .filter(p => !p.error)
        .reduce((sum, p) => sum + (p.downloads?.weekly || 0), 0),
      totalMonthlyDownloads: Object.values(latest.packages)
        .filter(p => !p.error)
        .reduce((sum, p) => sum + (p.downloads?.monthly || 0), 0)
    }
  };

  // Write report
  const reportPath = join(inputDir, 'report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);

  // Generate markdown report
  const markdown = generateMarkdownReport(report);
  const mdPath = join(inputDir, 'REPORT.md');
  writeFileSync(mdPath, markdown);
  console.log(`Markdown report written to ${mdPath}`);

  // Print summary
  console.log('');
  console.log('=== NPM Download Report ===');
  console.log(`Period: ${report.period.daysOfData} day(s) of data`);
  console.log(`Total Downloads: ${report.summary.totalDownloads}`);
  console.log(`Weekly Downloads: ${report.summary.totalWeeklyDownloads}`);
  console.log(`Monthly Downloads: ${report.summary.totalMonthlyDownloads}`);
}

function generateMarkdownReport(report) {
  let md = `# NPM Download Report

**Generated:** ${report.generatedAt}

## Summary

| Metric | Value |
|--------|-------|
| Total Packages | ${report.summary.totalPackages} |
| Total Downloads | ${report.summary.totalDownloads.toLocaleString()} |
| Weekly Downloads | ${report.summary.totalWeeklyDownloads.toLocaleString()} |
| Monthly Downloads | ${report.summary.totalMonthlyDownloads.toLocaleString()} |

## Package Details

`;

  for (const pkg of report.current.packages) {
    const trend = report.trends[pkg.name] || {};
    const trendEmoji = trend.trend === 'up' ? '📈' : trend.trend === 'down' ? '📉' : '➡️';
    
    md += `### ${pkg.name}

- **Version:** ${pkg.version}
- **Total Downloads:** ${pkg.downloads.total.toLocaleString()}
- **Weekly:** ${pkg.downloads.weekly.toLocaleString()}
- **Monthly:** ${pkg.downloads.monthly.toLocaleString()}
- **Trend:** ${trendEmoji} ${trend.percentGrowth || 'N/A'}

`;
  }

  md += `## Data Period

- **Start:** ${report.period.start}
- **End:** ${report.period.end}
- **Days of Data:** ${report.period.daysOfData}
`;

  return md;
}

generateReport();
