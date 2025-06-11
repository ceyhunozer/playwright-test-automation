import { expect } from '@playwright/test';
import { test } from './utils/env-config';
import { LoginPage } from './pages/login-page';
import { EventBrowserPage } from './pages/event-browser-page';
import { allure } from 'allure-playwright';

test.describe('Event Browser Error Handling', () => {
    let loginPage: LoginPage;
    let eventBrowserPage: EventBrowserPage;

    test.beforeEach(async ({ page, envConfig }) => {
        // Initialize pages
        loginPage = new LoginPage(page);
        eventBrowserPage = new EventBrowserPage(page);

        console.log('Starting Event Browser error tests setup...');

        // Configure timeout for authentication
        page.setDefaultTimeout(45000);

        // Login prerequisite with improved retry logic
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
            try {
                console.log(`Login attempt ${retryCount + 1}/${maxRetries + 1}`);
                
                await loginPage.goto();
                await loginPage.verifyLoginPageLoaded();
                
                await loginPage.loginWithDynamicTOTP(
                    envConfig.credentials.username,
                    envConfig.credentials.password
                );
                
                await loginPage.verifyLoginSuccessful();
                await page.waitForTimeout(5000); // Allow session to stabilize
                console.log('Login successful');
                break;
            } catch (error) {
                console.log(`Login attempt ${retryCount + 1} failed:`, error.message);
                
                if (retryCount === maxRetries) {
                    console.error('Max login retries exceeded');
                    throw new Error(`Authentication failed after ${maxRetries} attempts: ${error.message}`);
                }
                
                // Clear cookies and storage between attempts
                await page.context().clearCookies();
                await page.evaluate(() => window.localStorage.clear());
                await page.evaluate(() => window.sessionStorage.clear());
                
                retryCount++;
                await page.waitForTimeout(3000 * retryCount);
            }
        }

        // Navigate to Event Browser with improved error handling
        console.log('Navigating to Event Browser page...');
        try {
            await page.waitForTimeout(2000); // Additional wait for auth
            await eventBrowserPage.goto();
            
            await Promise.race([
                eventBrowserPage.verifyPageLoaded(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Event Browser page load timeout')), 30000)
                )
            ]);
            console.log('Event Browser page loaded successfully');
            
        } catch (error) {
            console.error('Failed to load Event Browser page:', error.message);
            const currentUrl = page.url();
            console.log('Current URL:', currentUrl);
            
            if (currentUrl.includes('login') || currentUrl.includes('twoFactor')) {
                throw new Error('Authentication appears to be lost - redirected to login page');
            }
            
            // Attempt recovery
            console.log('Attempting page recovery...');
            await page.reload({ waitUntil: 'networkidle' });
            await eventBrowserPage.verifyPageLoaded();
        }
    });

    test.describe('Network Error Handling', () => {
        test('handles API timeout gracefully @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('API Timeout');
            allure.severity('critical');

            // Simulate slow network
            await page.route('**/api/events**', async route => {
                await new Promise(resolve => setTimeout(resolve, 31000)); // Longer than default timeout
                await route.continue();
            });

            // Attempt to load events
            await eventBrowserPage.refreshEvents();

            // Verify timeout error message
            await expect(page.locator('[data-testid="error-message"]')).toContainText('Request timeout');
        });

        test('handles network failure @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('Network Failure');
            allure.severity('critical');

            // Simulate network failure
            await page.route('**/api/events**', route => route.abort('failed'));

            // Attempt to load events
            await eventBrowserPage.refreshEvents();

            // Verify error message and retry button
            await expect(page.locator('[data-testid="error-message"]')).toContainText('Network error');
            await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

            // Test retry functionality
            await page.unroute('**/api/events**');
            await page.click('[data-testid="retry-button"]');
            await eventBrowserPage.waitForEventsToLoad();
        });
    });

    test.describe('Invalid Input Handling', () => {
        test('handles invalid date range @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('Invalid Date Range');
            allure.severity('normal');

            // Set future start date
            await page.click('[data-testid="time-range-selector"]');
            await page.getByText('custom').click();
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            await page.fill('[data-testid="start-date-picker"]', tomorrow.toISOString().split('T')[0]);
            
            // Verify error message
            await expect(page.locator('[data-testid="date-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="apply-custom-range"]')).toBeDisabled();
        });

        test('handles invalid page number @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('Invalid Page Number');
            allure.severity('normal');

            // Try negative page number
            await page.fill('[data-testid="page-input"]', '-1');
            await page.keyboard.press('Enter');
            await expect(page.locator('[data-testid="page-error"]')).toBeVisible();

            // Try page number beyond max
            await page.fill('[data-testid="page-input"]', '99999');
            await page.keyboard.press('Enter');
            await expect(page.locator('[data-testid="page-error"]')).toBeVisible();
        });
    });

    test.describe('Empty State Handling', () => {
        test('handles no events in time range @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('Empty Time Range');
            allure.severity('normal');

            // Select a very short recent time range
            await page.click('[data-testid="time-range-selector"]');
            await page.getByText('custom').click();
            
            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);
            
            await page.fill('[data-testid="start-date-picker"]', fiveMinutesAgo.toISOString().split('T')[0]);
            await page.fill('[data-testid="end-date-picker"]', now.toISOString().split('T')[0]);
            await page.click('[data-testid="apply-custom-range"]');

            // Verify empty state message
            await expect(page.locator('[data-testid="no-data-message"]')).toBeVisible();
        });

        test('handles all filters resulting in no matches @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('No Filter Matches');
            allure.severity('normal');

            // Apply multiple filters that ensure no matches
            await eventBrowserPage.filterEvents('non-existent-type');
            await eventBrowserPage.selectTimeRange('1hr');
            
            // Verify empty state with filter context
            await expect(page.locator('[data-testid="no-data-message"]')).toContainText('No events match the current filters');
            await expect(page.locator('[data-testid="clear-filters-button"]')).toBeVisible();

            // Test clear filters functionality
            await page.click('[data-testid="clear-filters-button"]');
            await eventBrowserPage.waitForEventsToLoad();
            const eventCount = await eventBrowserPage.getEventCount();
            await expect(eventCount).toBeGreaterThan(0);
        });
    });

    test.describe('Performance Degradation Handling', () => {
        test('handles slow response gracefully @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('Slow Response');
            allure.severity('normal');

            // Simulate slow response
            await page.route('**/api/events**', async route => {
                await new Promise(resolve => setTimeout(resolve, 5000));
                await route.continue();
            });

            // Verify loading state
            await eventBrowserPage.refreshEvents();
            await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
            await expect(page.locator('[data-testid="loading-message"]')).toContainText('Loading events');
        });

        test('handles large data sets @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('Large Data Sets');
            allure.severity('normal');

            // Select maximum time range
            await eventBrowserPage.selectTimeRange('7d');
            await page.click('[data-testid="page-size-selector"]');
            await page.getByText('100').click();

            // Verify performance warning if present
            const warningMessage = page.locator('[data-testid="performance-warning"]');
            if (await warningMessage.isVisible()) {
                await expect(warningMessage).toContainText('Large amount of data');
            }

            // Verify data loads successfully
            await eventBrowserPage.waitForEventsToLoad();
            const eventCount = await eventBrowserPage.getEventCount();
            await expect(eventCount).toBeGreaterThan(0);
        });
    });

    test.describe('Session Handling', () => {
        test('handles session timeout @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('Session Timeout');
            allure.severity('critical');

            // Simulate session timeout
            await page.route('**/api/events**', route => route.fulfill({
                status: 401,
                body: JSON.stringify({ error: 'Session expired' })
            }));

            // Attempt to load events
            await eventBrowserPage.refreshEvents();

            // Verify session timeout handling
            await expect(page.locator('[data-testid="session-timeout-message"]')).toBeVisible();
            await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
        });

        test('handles permission changes @error', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Error Handling');
            allure.story('Permission Changes');
            allure.severity('critical');

            // Simulate permission error
            await page.route('**/api/events**', route => route.fulfill({
                status: 403,
                body: JSON.stringify({ error: 'Insufficient permissions' })
            }));

            // Attempt to load events
            await eventBrowserPage.refreshEvents();

            // Verify permission error handling
            await expect(page.locator('[data-testid="permission-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="contact-admin-button"]')).toBeVisible();
        });
    });
});