# Releasing

This repo is set up to be published as the `screenstage` npm package on npmjs.org, with a scoped GitHub Packages mirror published from tags.

## Before The First Public Release

1. Confirm the npm package name is still available.
2. Configure npm trusted publishing for this repo and its `release.yml` workflow.
3. Make sure the public repo metadata in `package.json` matches the live GitHub repo.

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

6. Publish manually if you want to ship before using GitHub Actions:

```bash
npm publish --access public
```

## GitHub Release Workflow

The release workflow publishes on version tags that start with `v`, for example:

- `v0.1.0`
- `v0.1.1`

It will:

1. install dependencies
2. run `npm run check`
3. run `npm run build`
4. publish to npmjs.org through npm trusted publishing
5. publish a scoped mirror to GitHub Packages as `@<owner>/screenstage`

If you prefer release notes first, create the GitHub release from the pushed tag after CI passes.

## GitHub Packages Mirror

The release workflow also publishes a mirror package to GitHub Packages so the repo can show a package entry under its Packages area.

Mirror package shape:

- npmjs.org: `screenstage`
- GitHub Packages: `@<owner>/screenstage`

The workflow rewrites the package name only inside CI before the GitHub Packages publish step. The source `package.json` remains the unscoped npmjs package definition.

## Authentication Model

This repo now uses two different publish auth paths:

- npmjs.org publish: npm trusted publishing through GitHub Actions OIDC
- GitHub Packages mirror: the built-in `GITHUB_TOKEN` with `packages: write`

That means:

- no `NPM_TOKEN` repository secret is required for npmjs releases
- no manually-added `GITHUB_TOKEN` secret is required for GitHub Packages
