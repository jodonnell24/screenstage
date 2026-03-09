# Releasing

This repo is set up to be published as the `motion-creator` npm package.

## Before The First Public Release

1. Confirm the public repository URL and add it to `package.json`:
   - `repository`
   - `homepage`
   - `bugs`
2. Confirm the npm package name is available.
3. Create an npm automation token and store it as `NPM_TOKEN` in GitHub Actions secrets.

## Local Release Checklist

1. Update `CHANGELOG.md`.
2. Bump the package version:

```bash
npm version patch
```

3. Verify the package contents:

```bash
npm run check
npm run build
npm run pack:check
```

4. Inspect the generated tarball list from `npm pack --dry-run` and confirm it only includes:
   - `dist/`
   - `package.json`
   - `readme.md`
   - `LICENSE`
   - `CHANGELOG.md`

5. Push the version tag:

```bash
git push --follow-tags
```

## GitHub Release Workflow

The release workflow publishes on version tags that start with `v`, for example:

- `v0.1.0`
- `v0.1.1`

It will:

1. install dependencies
2. run `npm run check`
3. run `npm run build`
4. run `npm publish --access public`

If you prefer release notes first, create the GitHub release from the pushed tag after CI passes.
