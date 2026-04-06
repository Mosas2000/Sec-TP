# Versioning Strategy

This document outlines the versioning strategy for the TipStream SDK.

## Semantic Versioning

The TipStream SDK follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRERELEASE]
```

| Component | When to Increment |
|-----------|-------------------|
| **MAJOR** | Breaking changes to public API |
| **MINOR** | New features (backward compatible) |
| **PATCH** | Bug fixes (backward compatible) |
| **PRERELEASE** | Alpha, beta, RC releases |

## Version Progression

### Development Phase

```
1.0.0-alpha.0    First alpha release
1.0.0-alpha.1    Alpha iterations
1.0.0-alpha.2    ...
1.0.0-beta.0     First beta release
1.0.0-beta.1     Beta iterations
1.0.0-rc.0       Release candidate
1.0.0-rc.1       RC iterations
1.0.0            Production release
```

### Post-Release

```
1.0.0            Initial release
1.0.1            Bug fix
1.0.2            Another bug fix
1.1.0            New feature
1.2.0            More features
2.0.0            Breaking change
```

## Package Versioning

All packages in the monorepo are versioned together:

| Package | Version |
|---------|---------|
| `@tipstream/sdk-core` | 1.0.0 |
| `@tipstream/sdk-security` | 1.0.0 |
| `@tipstream/sdk-metrics` | 1.0.0 |

This ensures compatibility across packages.

## Breaking Changes

### What Constitutes a Breaking Change

- Removing a public API method or class
- Changing method signatures (parameters, return types)
- Changing default behavior
- Removing configuration options
- Changing error types or messages that users depend on

### What is NOT a Breaking Change

- Adding new methods or classes
- Adding optional parameters
- Bug fixes that don't change intended behavior
- Performance improvements
- Adding new configuration options with defaults
- Documentation updates

## Deprecation Policy

1. **Announce**: Document deprecation in CHANGELOG and JSDoc
2. **Warning**: Emit runtime warning for deprecated usage
3. **Timeline**: Minimum one minor version before removal
4. **Removal**: Remove in next major version

Example:

```typescript
/**
 * @deprecated Use `newMethod()` instead. Will be removed in v2.0.0.
 */
function oldMethod() {
  console.warn('Warning: oldMethod() is deprecated. Use newMethod() instead.');
  return newMethod();
}
```

## Git Tags

Tags follow the format `v{VERSION}`:

```bash
git tag v1.0.0
git tag v1.0.1
git tag v1.1.0-beta.0
git tag v2.0.0-alpha.1
```

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `dev` | Development integration |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `release/*` | Release preparation |
| `hotfix/*` | Production fixes |

## Release Checklist

### Pre-Release

- [ ] All tests passing
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in all package.json files

### Release

- [ ] Create release branch (`release/v1.0.0`)
- [ ] Final testing
- [ ] Merge to main
- [ ] Create git tag
- [ ] Publish to npm
- [ ] Create GitHub release

### Post-Release

- [ ] Merge main back to dev
- [ ] Announce release
- [ ] Monitor for issues

## NPM Tags

| Tag | Purpose |
|-----|---------|
| `latest` | Current stable release |
| `next` | Pre-release versions |
| `alpha` | Alpha releases |
| `beta` | Beta releases |

```bash
# Install latest stable
npm install @tipstream/sdk-core

# Install pre-release
npm install @tipstream/sdk-core@next

# Install specific alpha
npm install @tipstream/sdk-core@1.0.0-alpha.0
```

## Version Ranges

### For Library Consumers

```json
{
  "dependencies": {
    "@tipstream/sdk-core": "^1.0.0"
  }
}
```

Using `^` allows automatic minor and patch updates while preventing breaking changes.

### For Application Developers

Consider using exact versions or lock files for reproducibility:

```json
{
  "dependencies": {
    "@tipstream/sdk-core": "1.0.0"
  }
}
```

## Support Policy

| Version | Support Status |
|---------|----------------|
| Latest major | Full support |
| Previous major | Security fixes only (6 months) |
| Older versions | No support |

## Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [1.1.0] - 2024-01-15

### Added
- New encryption method for performance (#123)
- Support for custom reporters (#125)

### Changed
- Improved retry logic with jitter (#124)

### Deprecated
- `oldMethod()` - use `newMethod()` instead

### Fixed
- Memory leak in metrics collector (#126)

### Security
- Updated dependencies to fix CVE-XXXX-XXXX
```

## Automation

Version management is handled by:

1. **scripts/release.js**: Automates version bumping and changelog
2. **.github/workflows/publish.yml**: Automates npm publishing
3. **Conventional commits**: Enables automatic changelog generation

```bash
# Patch release
npm run release -- patch

# Minor release
npm run release -- minor

# Major release
npm run release -- major

# Pre-release
npm run release -- prerelease --preid=alpha
```
