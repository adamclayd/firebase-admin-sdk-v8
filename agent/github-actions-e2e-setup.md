# GitHub Actions E2E Testing Setup

## Overview
This document explains how to set up GitHub Actions to run e2e tests automatically using GitHub Secrets to store the Firebase service account credentials securely.

## GitHub Secrets Setup

### 1. Get Service Account JSON
Download your Firebase service account JSON file from:
- Firebase Console → Project Settings → Service Accounts → Generate New Private Key

### 2. Add Secret to GitHub Repository

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_SERVICE_ACCOUNT`
5. Value: Paste the **entire contents** of your service-account.json file
6. Click **Add secret**

### 3. Verify Workflow File

The workflow file [`.github/workflows/e2e-tests.yml`](../.github/workflows/e2e-tests.yml) is already configured to:
- Run on push to mainline branch
- Run on pull requests
- Allow manual triggering
- Use the `FIREBASE_SERVICE_ACCOUNT` secret

## How It Works

### Workflow Steps

1. **Checkout code** - Gets the latest code
2. **Setup Node.js** - Installs Node.js 20 with npm cache
3. **Install dependencies** - Runs `npm ci`
4. **Run unit tests** - Runs `npm test` (fast, no secrets needed)
5. **Create service account file** - Writes secret to `service-account.json`
6. **Run e2e tests** - Runs `npm run test:e2e` with real Firebase
7. **Clean up** - Removes `service-account.json` (runs even if tests fail)

### Security Features

- ✅ Secret is never logged or exposed in workflow output
- ✅ Service account file is created at runtime, not committed
- ✅ File is deleted after tests complete (even on failure)
- ✅ Secret is only accessible to this repository
- ✅ Secret is encrypted at rest in GitHub

## Running E2E Tests

### Locally
```bash
# Requires service-account.json in project root
npm run test:e2e
```

### In GitHub Actions
- **Automatic**: Runs on every push to mainline
- **Manual**: Go to Actions tab → E2E Tests → Run workflow

### In Pull Requests
- E2E tests run automatically on PRs to mainline
- Must have `FIREBASE_SERVICE_ACCOUNT` secret configured

## Monitoring

### View Test Results
1. Go to **Actions** tab in GitHub
2. Click on a workflow run
3. Click on **e2e-tests** job
4. Expand **Run e2e tests** step to see results

### Test Failures
If e2e tests fail:
1. Check the workflow logs for error messages
2. Verify `FIREBASE_SERVICE_ACCOUNT` secret is set correctly
3. Ensure Firebase project and database are properly configured
4. Check Firestore rules and indexes are deployed

## Updating the Secret

If you rotate your service account key:
1. Generate new key in Firebase Console
2. Update `FIREBASE_SERVICE_ACCOUNT` secret in GitHub
3. Re-run failed workflows

## Cost Considerations

### Firebase Quotas
- E2E tests make real API calls to Firebase
- Monitor Firebase usage in Firebase Console
- Consider running e2e tests:
  - Only on mainline (not on every PR)
  - On a schedule (e.g., nightly)
  - Manually when needed

### GitHub Actions Minutes
- E2E tests take ~7 seconds
- Unit tests take ~3 seconds
- Total workflow: ~30 seconds per run
- Free tier: 2,000 minutes/month for public repos

## Alternative: Scheduled E2E Tests

To run e2e tests on a schedule instead of every push:

```yaml
on:
  schedule:
    - cron: '0 0 * * *'  # Run daily at midnight UTC
  workflow_dispatch:      # Allow manual trigger
```

## Troubleshooting

### Error: "service-account.json not found"
- Verify `FIREBASE_SERVICE_ACCOUNT` secret is set in GitHub
- Check the secret name matches exactly in the workflow file

### Error: "Invalid JWT Signature"
- Service account key might be expired or revoked
- Generate new key and update GitHub secret

### Error: "Cloud Firestore API has not been used"
- Ensure Firestore is enabled in Firebase project
- Run `firebase firestore:databases:create "(default)" --location=us-central1`

### Error: "The query requires an index"
- Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
- Wait a few minutes for indexes to build

## Security Best Practices

1. **Never commit service-account.json** - It's in .gitignore
2. **Rotate keys regularly** - Generate new keys every 90 days
3. **Use least privilege** - Service account should only have necessary permissions
4. **Monitor usage** - Check Firebase Console for unexpected activity
5. **Revoke compromised keys immediately** - If a key is exposed, delete it in Firebase Console

## Next Steps

1. Add `FIREBASE_SERVICE_ACCOUNT` secret to GitHub repository
2. Push code to trigger workflow
3. Monitor workflow run in Actions tab
4. Verify all 27 e2e tests pass in CI

## References

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Firebase Service Accounts](https://firebase.google.com/docs/admin/setup#initialize-sdk)
- [E2E Testing Best Practices](../agent/e2e-testing-best-practices.md)
