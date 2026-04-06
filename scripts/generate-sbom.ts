#!/usr/bin/env node

/**
 * SBOM (Software Bill of Materials) Generator
 * 
 * Generates CycloneDX format SBOM for the SDK packages.
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

const PACKAGES_DIR = './packages';
const OUTPUT_DIR = './sbom';

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  license?: string;
  dependencies: Record<string, string>;
}

interface SbomComponent {
  type: string;
  name: string;
  version: string;
  description?: string;
  licenses?: Array<{ license: { id: string } }>;
  purl?: string;
}

interface Sbom {
  bomFormat: string;
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: Array<{ name: string; version: string }>;
    component: SbomComponent;
  };
  components: SbomComponent[];
}

async function getPackageInfo(packagePath: string): Promise<PackageInfo> {
  const content = await fs.readFile(path.join(packagePath, 'package.json'), 'utf8');
  return JSON.parse(content);
}

async function getInstalledDependencies(): Promise<Map<string, { version: string; license: string }>> {
  const deps = new Map<string, { version: string; license: string }>();
  
  try {
    const result = execSync('npm ls --all --json', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const tree = JSON.parse(result);
    
    function traverse(node: Record<string, unknown>, parentName = '') {
      const dependencies = node.dependencies as Record<string, unknown> | undefined;
      if (!dependencies) return;
      
      for (const [name, info] of Object.entries(dependencies)) {
        const depInfo = info as { version?: string; license?: string; dependencies?: unknown };
        if (depInfo.version) {
          deps.set(name, {
            version: depInfo.version,
            license: (depInfo as { license?: string }).license ?? 'UNKNOWN',
          });
        }
        if (depInfo.dependencies) {
          traverse(depInfo as Record<string, unknown>, name);
        }
      }
    }
    
    traverse(tree);
  } catch (error) {
    console.error('Warning: Could not get full dependency tree');
  }
  
  return deps;
}

function generatePurl(name: string, version: string): string {
  const encodedName = encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${version}`;
}

async function generateSbom(): Promise<void> {
  console.log('🔍 Generating SBOM...\n');

  // Get root package info
  const rootPackage = await getPackageInfo('.');
  
  // Get all workspace packages
  const packageDirs = await fs.readdir(PACKAGES_DIR);
  const packages: PackageInfo[] = [];
  
  for (const dir of packageDirs) {
    const packagePath = path.join(PACKAGES_DIR, dir);
    const stat = await fs.stat(packagePath);
    
    if (stat.isDirectory()) {
      try {
        const pkg = await getPackageInfo(packagePath);
        packages.push(pkg);
      } catch {
        // Skip directories without package.json
      }
    }
  }

  // Get all dependencies
  const dependencies = await getInstalledDependencies();

  // Create SBOM
  const sbom: Sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        { name: 'tipstream-sbom-generator', version: '1.0.0' },
      ],
      component: {
        type: 'application',
        name: rootPackage.name,
        version: rootPackage.version,
        description: rootPackage.description,
        licenses: rootPackage.license ? [{ license: { id: rootPackage.license } }] : undefined,
        purl: generatePurl(rootPackage.name, rootPackage.version),
      },
    },
    components: [],
  };

  // Add workspace packages
  for (const pkg of packages) {
    sbom.components.push({
      type: 'library',
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      licenses: pkg.license ? [{ license: { id: pkg.license } }] : undefined,
      purl: generatePurl(pkg.name, pkg.version),
    });
  }

  // Add dependencies
  for (const [name, info] of dependencies) {
    sbom.components.push({
      type: 'library',
      name,
      version: info.version,
      licenses: info.license !== 'UNKNOWN' ? [{ license: { id: info.license } }] : undefined,
      purl: generatePurl(name, info.version),
    });
  }

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Write SBOM
  const sbomPath = path.join(OUTPUT_DIR, 'sbom.json');
  await fs.writeFile(sbomPath, JSON.stringify(sbom, null, 2));

  console.log(`✅ SBOM generated: ${sbomPath}`);
  console.log(`   Components: ${sbom.components.length}`);
  console.log(`   Format: CycloneDX 1.4\n`);

  // Generate summary report
  const summaryPath = path.join(OUTPUT_DIR, 'summary.txt');
  const summary = [
    'SBOM Summary Report',
    '===================',
    '',
    `Generated: ${sbom.metadata.timestamp}`,
    `Root Package: ${rootPackage.name}@${rootPackage.version}`,
    '',
    'Workspace Packages:',
    ...packages.map(p => `  - ${p.name}@${p.version}`),
    '',
    `Total Dependencies: ${dependencies.size}`,
    '',
    'License Summary:',
  ];

  const licenseCounts = new Map<string, number>();
  for (const info of dependencies.values()) {
    const count = licenseCounts.get(info.license) ?? 0;
    licenseCounts.set(info.license, count + 1);
  }

  for (const [license, count] of Array.from(licenseCounts.entries()).sort((a, b) => b[1] - a[1])) {
    summary.push(`  ${license}: ${count}`);
  }

  await fs.writeFile(summaryPath, summary.join('\n'));
  console.log(`📋 Summary written: ${summaryPath}`);
}

generateSbom().catch(console.error);
