# Codecov Setup Guide

This guide explains how to set up Codecov integration for code coverage reporting in GitHub Actions.

## Overview

The project uses Codecov to track and visualize code coverage. Coverage is collected during unit tests and uploaded to Codecov, which generates the coverage badge shown in the README.

## Prerequisites

- GitHub repository with Actions enabled
- Codecov account (free for public repositories)

## Setup Steps

### 1. Sign Up for Codecov

1. Go to [codecov.io](https://codecov.io/)
2. Sign in with your GitHub account
3. Authorize Codecov to access your repositories

### 2. Add Repository to Codecov

1. In Codecov dashboard, click "Add new repository"
2. Find and select `prmichaelsen/firebase-admin-sdk-v8`
3. Codecov will generate a repository upload token

### 3. Add CODECOV_TOKEN to GitHub Secrets

1. Copy the upload token from Codecov
2. Go to your GitHub repository
3. Navigate to **Settings** → **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Name: `CODECOV_TOKEN`
6. Value: Paste the token from Codecov
7. Click **Add secret**

### 4. Verify Setup

After adding the secret:

1. Push a commit or manually trigger the "Unit Tests" workflow
2. Wait for the workflow to complete
3. Check the "Upload coverage to Codecov" step in the workflow logs
4. Visit your Codecov dashboard to see the coverage report
5. The badge in README.md should now display the current coverage percentage

## How It Works

### Jest Configuration

The [`jest.config.js`](../jest.config.js) file is configured to collect coverage:

```javascript
{
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e.ts',
  ],
}
```

This generates:
- `coverage/lcov.info` - Machine-readable coverage data for Codecov
- `coverage/index.html` - Human-readable HTML report (local only)
- Terminal output - Summary displayed after test run

### GitHub Actions Workflow

The [`.github/workflows/test.yml`](../.github/workflows/test.yml) workflow:

1. Runs unit tests with `npm test` (which generates coverage)
2. Uploads coverage to Codecov (only on Node.js 20 to avoid duplicate uploads)

```yaml
- name: Upload coverage to Codecov (Node 20 only)
  if: matrix.node-version == 20
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/lcov.info
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: false
```

### Coverage Badge

The README includes a Codecov badge:

```markdown
[![codecov](https://codecov.io/gh/prmichaelsen/firebase-admin-sdk-v8/branch/mainline/graph/badge.svg)](https://codecov.io/gh/prmichaelsen/firebase-admin-sdk-v8)
```

This badge:
- Shows current coverage percentage
- Links to the full Codecov report
- Updates automatically after each push to mainline

## Local Coverage Reports

To view coverage locally:

```bash
# Run tests with coverage
npm test

# Open HTML report in browser
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

## Troubleshooting

### Badge Shows "unknown"

**Cause**: Codecov hasn't received coverage data yet

**Solution**:
1. Check that CODECOV_TOKEN is set correctly in GitHub Secrets
2. Verify the "Upload coverage to Codecov" step succeeded in GitHub Actions
3. Wait a few minutes for Codecov to process the upload

### Upload Fails with "401 Unauthorized"

**Cause**: Invalid or missing CODECOV_TOKEN

**Solution**:
1. Regenerate the token in Codecov dashboard
2. Update the CODECOV_TOKEN secret in GitHub
3. Re-run the workflow

### Coverage Not Collected

**Cause**: Jest not configured to collect coverage

**Solution**:
1. Verify `collectCoverage: true` in jest.config.js
2. Check that test files match the pattern `**/*.spec.ts`
3. Ensure source files are in `src/**/*.ts`

### Coverage Lower Than Expected

**Cause**: Some files not covered by tests

**Solution**:
1. Run `npm test` locally to see coverage report
2. Check `coverage/index.html` for detailed file-by-file breakdown
3. Add tests for uncovered files or functions

## Coverage Goals

Current coverage: **58.54%**

Target coverage goals:
- **60%** - Minimum acceptable (current target)
- **70%** - Good coverage
- **80%** - Excellent coverage
- **90%+** - Exceptional coverage

Focus areas for improvement:
1. Error handling paths
2. Edge cases in converters
3. Token generation edge cases
4. X.509 certificate parsing

## Related Files

- [`jest.config.js`](../jest.config.js) - Jest configuration with coverage settings
- [`.github/workflows/test.yml`](../.github/workflows/test.yml) - CI workflow with Codecov upload
- [`README.md`](../README.md) - Includes coverage badge
- [`agent/progress.yaml`](./progress.yaml) - Tracks coverage metrics

## Security Notes

- The CODECOV_TOKEN is a **repository secret** - never commit it to the repository
- The token only allows uploading coverage data, not reading or modifying repository settings
- Codecov v4 requires a token even for public repositories (change from v3)
- The token is scoped to a single repository

## References

- [Codecov Documentation](https://docs.codecov.com/)
- [Codecov GitHub Action](https://github.com/codecov/codecov-action)
- [Jest Coverage Configuration](https://jestjs.io/docs/configuration#collectcoverage-boolean)
