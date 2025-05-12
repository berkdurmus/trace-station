#!/usr/bin/env node

/**
 * This script enhances the Playwright documentation with additional
 * curated entries for common test failure scenarios.
 */

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "../../../data/docs");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${OUTPUT_DIR}`);
}

// Additional documentation entries for common Playwright test failures
const additionalDocs = [
  {
    filename: "common-failures-selectors.md",
    content: `# Common Selector Failures in Playwright

## Selector Not Found

When Playwright reports "Element not found" or similar errors:

### Common Causes
- The element doesn't exist in the DOM
- The element exists but is not visible
- The element is in an iframe or shadow DOM
- There's a timing issue and the element hasn't loaded yet
- The element's attributes or structure changed

### Solutions
- Use \`waitForSelector\` to wait for the element to appear
- Check if the selector is correct using Playwright Inspector
- Try more robust selectors:
  - Text-based: \`getByText('Submit')\`, \`getByLabel('Username')\`
  - Test ID-based: \`getByTestId('submit-button')\`
  - Role-based: \`getByRole('button', { name: 'Submit' })\`
- Increase timeout values in your config or for specific actions
- Check if the element is inside an iframe or shadow DOM

## Selector Ambiguity

When Playwright reports "Ambiguous selector" or "Multiple elements found":

### Common Causes
- Your selector matches multiple elements
- Dynamic content is creating duplicate elements

### Solutions
- Make your selector more specific
- Use \`first()\`, \`last()\`, or \`nth()\` to select a specific element
- Add unique test IDs to elements for testing
- Use more specific attributes or combinations of selectors
`,
  },
  {
    filename: "common-failures-timeouts.md",
    content: `# Timeouts in Playwright Tests

## Common Timeout Issues

Timeouts occur when an operation takes longer than the allowed time. 

### Common Causes
- Slow network connections or server responses
- Long-running JavaScript operations
- Page not loading completely
- Waiting for an element that never appears
- Navigation issues

## Timeout Settings in Playwright

### Global Timeouts
In \`playwright.config.js\`:
\`\`\`javascript
// playwright.config.js
module.exports = {
  timeout: 30000, // Global timeout for all tests (30 seconds)
  expect: {
    timeout: 5000, // Timeout for expect assertions
  },
}
\`\`\`

### Test-specific Timeouts
\`\`\`javascript
test.setTimeout(60000); // Set timeout for a specific test to 60 seconds
\`\`\`

### Action-specific Timeouts
\`\`\`javascript
await page.click('selector', { timeout: 10000 }); // Wait up to 10 seconds
await page.waitForSelector('selector', { timeout: 10000 });
\`\`\`

## Best Practices

- Start with longer timeouts during development
- Use specific waiting mechanisms:
  - \`page.waitForSelector()\` - Wait for element to be visible
  - \`page.waitForNavigation()\` - Wait for navigation to complete
  - \`page.waitForLoadState('networkidle')\` - Wait for network to be idle
  - \`page.waitForResponse()\` - Wait for a specific network response
- Consider network throttling for testing under poor conditions
- Add retry logic for flaky tests
`,
  },
  {
    filename: "common-failures-assertions.md",
    content: `# Assertion Failures in Playwright

## Common Assertion Errors

Assertion failures happen when the expected state doesn't match the actual state.

### Types of Assertion Failures
- Element state unexpected (visible/hidden/enabled/disabled)
- Text or attribute value mismatch
- Element counts incorrect
- Timing issues where assertion runs too early
- Network response status or content differs from expected

## Effective Assertions

### Stable Assertions
\`\`\`javascript
// Wait for element to be visible before assertion
await expect(page.locator('.status')).toBeVisible();

// Wait for specific text to appear
await expect(page.locator('.status')).toHaveText('Success');

// Check if element contains partial text
await expect(page.locator('.message')).toContainText('completed');

// Verify attribute value
await expect(page.locator('input')).toHaveAttribute('disabled', '');

// Check element count
await expect(page.locator('li.item')).toHaveCount(5);
\`\`\`

### Custom Assertions with Polling
\`\`\`javascript
// Custom assertion with polling
await expect(async () => {
  const text = await page.locator('.count').textContent();
  expect(parseInt(text)).toBeGreaterThan(5);
}).toPass();
\`\`\`

## Best Practices

- Use appropriate assertion methods for the condition you're testing
- Add helpful assertion messages
- Wait for the application to reach the expected state before asserting
- Consider retry logic for flaky assertions
- Make assertions specific and targeted rather than overly broad
`,
  },
  {
    filename: "common-failures-navigation.md",
    content: `# Navigation Issues in Playwright

## Common Navigation Failures

Navigation issues can manifest as timeouts, incorrect page loading, or unexpected redirects.

### Common Causes
- Slow page loading
- Redirects causing confusion
- Single-page application routing not working as expected
- Missing waitForNavigation calls
- Resource loading failures
- Authentication issues

## Effective Navigation Techniques

### Waiting for Navigation Events
\`\`\`javascript
// Wait for navigation after clicking
await Promise.all([
  page.waitForNavigation(),
  page.click('a.nav-link')
]);

// Wait for a specific URL
await page.waitForURL('**/dashboard');

// Wait for load state
await page.waitForLoadState('networkidle');
\`\`\`

### Common Navigation Patterns

#### For traditional multi-page applications:
\`\`\`javascript
await Promise.all([
  page.waitForNavigation(),
  page.click('a.link-to-new-page')
]);
\`\`\`

#### For SPAs (Single Page Applications):
\`\`\`javascript
await page.click('a.spa-link');
await page.waitForURL('**/new-route');
// or
await page.waitForSelector('h1.new-page-header');
\`\`\`

## Best Practices

- Always wait for navigation to complete before interacting with the new page
- Be explicit about which load state you need (load, domcontentloaded, networkidle)
- For SPAs, wait for specific elements rather than full navigation events
- Handle redirects by waiting for the final URL pattern
- Increase timeouts for slow-loading pages
`,
  },
  {
    filename: "common-failures-network.md",
    content: `# Network Issues in Playwright Tests

## Common Network Failures

Network-related failures can significantly impact test reliability.

### Common Causes
- API endpoints returning errors (4xx, 5xx status codes)
- Network timeouts
- CORS issues
- Authentication failures
- Rate limiting
- Unstable test environment

## Handling Network Issues

### Monitoring Network Traffic
\`\`\`javascript
// Log all network requests
page.on('request', request => console.log('>>', request.method(), request.url()));
page.on('response', response => console.log('<<', response.status(), response.url()));

// Wait for specific API response
const responsePromise = page.waitForResponse('**/api/data');
await page.click('#load-data');
const response = await responsePromise;
expect(response.status()).toBe(200);
\`\`\`

### Mocking Network Requests
\`\`\`javascript
// Mock API response
await page.route('**/api/products', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 1, name: 'Product 1' }]),
  });
});

// Abort specific requests (e.g., analytics)
await page.route('**/analytics/**', route => route.abort());

// Simulate network errors
await page.route('**/api/unreliable', route => {
  route.fulfill({ status: 500 });
});
\`\`\`

## Best Practices

- Use route mocking for external dependencies
- Add request/response logging for debugging
- Implement retry logic for flaky network requests
- Consider testing both success and error scenarios
- Use waitForResponse to ensure critical requests complete
- Handle authentication properly in tests
`,
  },
  {
    filename: "common-failures-flakiness.md",
    content: `# Handling Flaky Tests in Playwright

## What Makes Tests Flaky?

Flaky tests pass sometimes and fail other times without code changes.

### Common Causes
- Race conditions
- Timeouts too short for variable conditions
- Animation and transition effects
- Network issues
- Third-party dependencies
- Resource contention in CI environments
- Browser-specific behavior differences

## Strategies to Reduce Flakiness

### Proper Waiting
\`\`\`javascript
// Wait for specific state before proceeding
await page.waitForSelector('.loaded');
await page.waitForLoadState('networkidle');
await page.waitForFunction(() => window.serverData !== undefined);
\`\`\`

### Retry Logic
\`\`\`javascript
// Configure retries in playwright.config.js
module.exports = {
  retries: process.env.CI ? 2 : 0, // Retry twice in CI, none locally
}

// Retry specific actions
const maxRetries = 3;
let attempts = 0;
while (attempts < maxRetries) {
  try {
    await page.click('#flaky-button');
    break; // Success, exit loop
  } catch (error) {
    attempts++;
    if (attempts === maxRetries) throw error;
    await page.waitForTimeout(1000); // Wait before retry
  }
}
\`\`\`

### Isolation and Mocking
- Use new browser context for each test
- Mock external dependencies
- Use predictable test data

### Visual Comparisons
\`\`\`javascript
// Compare screenshots for visual testing
await expect(page).toHaveScreenshot('expected.png', {
  maxDiffPixelRatio: 0.05 // Allow 5% difference
});
\`\`\`

## Best Practices

- Run tests in isolation
- Design tests to be idempotent (can run multiple times without side effects)
- Use video recording and traces to debug flakiness
- Add sufficient logging in tests
- Ensure stable test environments
- Consider browser-specific behaviors
`,
  },
];

// Write additional documentation files
function writeAdditionalDocs() {
  console.log("Creating enhanced documentation entries...");

  for (const doc of additionalDocs) {
    try {
      const filePath = path.join(OUTPUT_DIR, doc.filename);
      fs.writeFileSync(filePath, doc.content);
      console.log(`Created: ${filePath}`);
    } catch (error: any) {
      console.error(`Error creating ${doc.filename}:`, error.message);
    }
  }

  console.log("Documentation enhancement complete!");
}

// Execute main function
writeAdditionalDocs();
