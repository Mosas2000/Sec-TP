# Publishing Guide

## Package Structure

The SDK is published as multiple npm packages under the `@tipstream` scope:

| Package | npm | GitHub Packages |
|---------|-----|-----------------|
| @tipstream/sdk-core | ✅ | ✅ |
| @tipstream/sdk-security | ✅ | ✅ |
| @tipstream/sdk-metrics | ✅ | ✅ |

## Version Strategy

We use **Semantic Versioning** (SemVer):

- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

### Pre-release Versions

- `alpha`: Early development, unstable API
- `beta`: Feature complete, testing phase
- `rc`: Release candidate, final testing

Example: `1.0.0-alpha.1`, `1.0.0-beta.2`, `1.0.0-rc.1`

## Publishing Workflow

### Automated (Recommended)

1. Create a release branch:
   ```bash
   git checkout -b release/v1.0.0
   ```

2. Update versions:
   ```bash
   npm version minor --workspaces
   ```

3. Push with tags:
   ```bash
   git push origin release/v1.0.0 --tags
   ```

4. Create a Pull Request → Merge → GitHub Actions publishes automatically

### Manual Publishing

1. Build all packages:
   ```bash
   npm run build
   ```

2. Run tests:
   ```bash
   npm test
   ```

3. Login to npm:
   ```bash
   npm login
   ```

4. Publish each package:
   ```bash
   npm publish -w @tipstream/sdk-core --access public
   npm publish -w @tipstream/sdk-security --access public
   npm publish -w @tipstream/sdk-metrics --access public
   ```

## npm Configuration

### .npmrc for Publishing

```ini
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
@tipstream:registry=https://registry.npmjs.org/
```

### Required Secrets

Set these in GitHub repository secrets:

- `NPM_TOKEN`: npm automation token
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Registry Configuration

### npm Registry (Primary)

All packages are published publicly to npm:
```
https://registry.npmjs.org/@tipstream/sdk-core
https://registry.npmjs.org/@tipstream/sdk-security
https://registry.npmjs.org/@tipstream/sdk-metrics
```

### GitHub Packages (Mirror)

Packages are also available via GitHub Packages:
```
https://npm.pkg.github.com/@tipstream/sdk-core
```

## Release Checklist

Before releasing:

- [ ] All tests passing
- [ ] Security audit clean (`npm audit`)
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] Version bumped appropriately
- [ ] Git tag created

## Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [1.1.0] - 2024-01-15

### Added
- New feature X

### Changed
- Updated behavior Y

### Fixed
- Bug fix Z

### Security
- Security improvement
```

## Troubleshooting

### "You must be logged in to publish"

```bash
npm login
```

### "Package name already exists"

Ensure you're using the correct scope (@tipstream).

### "Version already published"

Bump the version number before publishing.

### GitHub Packages 404

Ensure the package.json has the correct `publishConfig`:
```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```
