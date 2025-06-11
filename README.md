# Playwright Test Automation Project

This project contains automated tests for the Event Browser application using Playwright.

## Prerequisites

- Node.js 16 or higher
- npm or yarn
- Visual Studio Code (recommended)

## Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd playwright
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory and add the following:
```env
BASE_URL=https://qa.osapiens.cloud
API_URL=https://qa-api.osapiens.cloud
TEST_USERNAME=your-username
TEST_PASSWORD=your-password
```

## Running Tests

Run all tests:
```bash
npm test
```

Run specific test file:
```bash
npx playwright test tests/event-browser.spec.ts
```

Run tests with UI mode:
```bash
npx playwright test --ui
```

## Test Reports

- Playwright HTML report: `playwright-report/index.html`
- Allure report: Generate with `npm run allure-report`

## Project Structure

```
├── tests/                  # Test files
│   ├── event-browser.spec.ts
│   └── utils/             # Utility functions and helpers
├── playwright.config.ts   # Playwright configuration
└── package.json          # Project dependencies and scripts
```

## Contributing

1. Create a feature branch from develop:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```
2. Make your changes
3. Run tests locally:
```bash
npm test
```
4. Push your changes:
```bash
git add .
git commit -m "feat: your meaningful commit message"
git push origin feature/your-feature-name
```
5. Create a pull request to merge into develop branch
6. Once approved and tests pass, your code will be merged

### Branch Protection Rules

The repository has the following branch protection rules:
- `master`: Production branch
  - Requires pull request approvals
  - Must pass CI checks
  - No direct pushes
- `develop`: Development branch
  - Requires pull request approvals
  - Must pass CI checks
  - No direct pushes

### Continuous Integration

This project uses GitHub Actions for CI/CD:
- Runs all tests on push/PR to master or develop
- Generates and uploads test reports
- Publishes Allure reports as artifacts
