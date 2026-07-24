# Publishing and updating the package on npm

This guide describes how to publish `@signalk/signalk-to-stalk` to the public
[npm registry](https://www.npmjs.com/package/@signalk/signalk-to-stalk) for the
first time and how to release subsequent versions.

Run all commands from the repository root.

## 1. Check the prerequisites

You need:

- Node.js 18 or newer;
- a current npm CLI;
- an npm account with two-factor authentication (2FA) enabled;
- permission to publish packages in the `@signalk` npm organization; and
- permission to push commits and tags to
  `https://github.com/OpenFairWind/signalk-to-stalk`.

Check the installed versions:

```bash
node --version
npm --version
```

Sign in to npm:

```bash
npm login
```

Confirm the account and registry:

```bash
npm whoami
npm config get registry
```

The registry must be:

```text
https://registry.npmjs.org/
```

If a different registry is configured, select the public npm registry:

```bash
npm config set registry https://registry.npmjs.org/
```

Publishing requires 2FA or an appropriately configured granular access token.
For an interactive release, prefer account 2FA and enter the one-time code when
npm prompts for it. Do not store passwords, recovery codes, or npm tokens in
this repository.

If `npm publish` reports a permission error, ask an owner of the `@signalk`
organization to grant the npm account write access to the package. GitHub
organization membership does not automatically grant npm organization access.

## 2. Prepare the release

Start from the branch and commit intended for release. Fetch the latest remote
state and confirm that the working tree does not contain accidental changes:

```bash
git fetch origin
git status --short
git branch --show-current
```

Review the changes since the previous release. Replace `<previous-tag>` with
the most recent release tag, for example `v2.0.0`:

```bash
git log --oneline <previous-tag>..HEAD
git diff <previous-tag>..HEAD
```

Before changing the version:

1. Update `CHANGELOG.md` with the release date and user-visible changes.
2. Confirm that `package.json` still contains:
   - the name `@signalk/signalk-to-stalk`;
   - the repository
     `https://github.com/OpenFairWind/signalk-to-stalk`; and
   - the intended `files` whitelist.
3. Confirm that no credentials, local configuration, generated archives, IDE
   files, or caches are included.
4. Commit all intended release changes.

## 3. Validate the package

Install exactly the dependencies recorded in `package-lock.json`:

```bash
npm ci
```

Run the required project checks:

```bash
npm run check
npm test
```

Inspect the files that npm would publish:

```bash
npm pack --dry-run
```

Read the complete file list and reported package name and version. The archive
must contain only the runtime, WebApp, license, changelog, and documentation
files selected by the `files` whitelist in `package.json`. Stop if the output
contains credentials, local configuration, caches, IDE files, or generated
tarballs.

For a stronger local inspection, create the archive:

```bash
npm pack
```

Inspect its contents, replacing `<version>` with the current package version:

```bash
tar -tzf signalk-signalk-to-stalk-<version>.tgz
```

Delete the generated `.tgz` after inspection. It is a local build artifact and
must not be committed.

## 4. Choose the next version

npm does not allow an already published package version to be overwritten or
reused. Check the local and published versions:

```bash
npm pkg get version
npm view @signalk/signalk-to-stalk version
npm view @signalk/signalk-to-stalk versions --json
```

Choose the version according to semantic versioning:

- `patch` for backward-compatible fixes, for example `2.0.0` to `2.0.1`;
- `minor` for backward-compatible features, for example `2.0.0` to `2.1.0`;
- `major` for incompatible changes, for example `2.0.0` to `3.0.0`.

After the changelog is ready and committed, update the version:

```bash
npm version patch
```

Use `minor` or `major` instead of `patch` when appropriate. By default,
`npm version` updates `package.json` and `package-lock.json`, creates a Git
commit, and creates a `v<version>` Git tag.

Review the result:

```bash
git show --stat
git tag --points-at HEAD
npm pkg get version
```

Run the validation commands again after the version change:

```bash
npm run check
npm test
npm pack --dry-run
```

## 5. Publish the package

### First publication

This is a scoped package, and scoped packages must explicitly be made public on
their first publication:

```bash
npm publish --access public
```

Enter the 2FA one-time password when prompted. Alternatively, it can be supplied
for that command:

```bash
npm publish --access public --otp=<one-time-code>
```

Do not put an OTP or token in a script, shell history, committed file, or
documentation example containing a real value.

### Publishing an update

For later releases, the package retains its public access setting. Publish the
new, previously unused version with:

```bash
npm publish
```

Using `--access public` again is also valid:

```bash
npm publish --access public
```

The default npm distribution tag is `latest`. A normal stable release should
use it. For a prerelease such as `2.1.0-beta.1`, use a non-default tag so that
ordinary installs do not receive the prerelease:

```bash
npm publish --access public --tag beta
```

Never use `--force` to work around a version conflict. Increment the version
and publish a new release instead.

## 6. Verify the publication

Confirm the registry version and tags:

```bash
npm view @signalk/signalk-to-stalk version
npm view @signalk/signalk-to-stalk dist-tags
npm view @signalk/signalk-to-stalk@<version>
```

Confirm that the published archive contains the expected files:

```bash
npm pack @signalk/signalk-to-stalk@<version>
tar -tzf signalk-signalk-to-stalk-<version>.tgz
```

Delete this verification archive after inspection.

Finally, open the
[package page on npm](https://www.npmjs.com/package/@signalk/signalk-to-stalk)
and verify its version, README, repository link, license, and files.

## 7. Push the release commit and tag

If `npm version` created the version commit and tag locally, publish both to
GitHub:

```bash
git push origin HEAD
git push origin v<version>
```

Then create the corresponding GitHub release from the pushed tag and use the
matching `CHANGELOG.md` section as its release notes.

Some teams push the commit and tag before `npm publish`; others publish first.
Whichever order is chosen, do not leave npm and GitHub advertising different
versions. If repository rules require a pull request, merge the version and
changelog changes first, create the tag from the merged release commit, and
publish from that exact commit.

## 8. Correcting release problems

Published npm versions are immutable. To correct code or metadata:

1. Fix the problem in the repository.
2. Add a changelog entry.
3. Run `npm run check`, `npm test`, and `npm pack --dry-run`.
4. Increment the version, normally with `npm version patch`.
5. Publish the new version.

If a published version should not be installed, deprecate that version and
direct users to the replacement:

```bash
npm deprecate @signalk/signalk-to-stalk@<bad-version> \
  "Do not use this release; install <replacement-version> instead."
```

Deprecation is safer than unpublishing because existing installations remain
resolvable. Unpublishing is restricted by npm policy, cannot be undone, and
does not make the same package name and version reusable. Use it only for a
serious accidental publication after reviewing npm's current
[unpublish policy](https://docs.npmjs.com/policies/unpublish/).

## Release checklist

- [ ] The release commit is the exact code intended for publication.
- [ ] `CHANGELOG.md` describes the release.
- [ ] `package.json` metadata and `files` are correct.
- [ ] The version does not already exist on npm.
- [ ] `npm run check` succeeds.
- [ ] `npm test` succeeds.
- [ ] `npm pack --dry-run` contains only intended files.
- [ ] The package is published with the correct npm distribution tag.
- [ ] The published metadata and archive are verified.
- [ ] The Git commit and `v<version>` tag are pushed.
- [ ] The GitHub release matches the npm release.

## npm references

- [Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [Updating a published package version](https://docs.npmjs.com/updating-your-published-package-version-number)
- [Two-factor authentication for publishing](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)
- [Deprecating package versions](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/)
- [npm unpublish policy](https://docs.npmjs.com/policies/unpublish/)
