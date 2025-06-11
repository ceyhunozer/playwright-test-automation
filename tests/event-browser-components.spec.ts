import { expect } from '@playwright/test';
import { test } from './utils/env-config';
import { LoginPage } from './pages/login-page';
import { EventBrowserPage } from './pages/event-browser-page';
import { allure } from 'allure-playwright';

test.describe('Event Browser Component Tests', () => {
    let loginPage: LoginPage;
    let eventBrowserPage: EventBrowserPage;

    test.beforeEach(async ({ page, envConfig }) => {
        // Initialize pages
        loginPage = new LoginPage(page);
        eventBrowserPage = new EventBrowserPage(page);

        console.log('Starting Event Browser component tests setup...');

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

    test.describe('Time Range Selector Component', () => {
        test('displays all available time ranges @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Time Range Selector');
            allure.severity('normal');

            await page.click('[data-testid="time-range-selector"]');
            
            // Verify all time range options are present
            const timeRanges = ['1hr', '24hr', '7d', 'custom'];
            for (const range of timeRanges) {
                await expect(page.getByText(range)).toBeVisible();
            }
        });

        test('custom time range picker functionality @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Custom Time Range');
            allure.severity('normal');

            // Open time range selector
            await page.click('[data-testid="time-range-selector"]');
            await page.getByText('custom').click();

            // Verify date picker components
            await expect(page.locator('[data-testid="start-date-picker"]')).toBeVisible();
            await expect(page.locator('[data-testid="end-date-picker"]')).toBeVisible();
            
            // Test date selection
            await page.locator('[data-testid="start-date-picker"]').click();
            await page.locator('.calendar-day').first().click();
            await page.locator('[data-testid="end-date-picker"]').click();
            await page.locator('.calendar-day').nth(1).click();
            
            // Apply custom range
            await page.click('[data-testid="apply-custom-range"]');
            await eventBrowserPage.waitForEventsToLoad();
        });
    });

    test.describe('Filter Component', () => {
        test('filter input behavior @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Filter Input');
            allure.severity('normal');

            const filterInput = page.locator('[data-testid="filter-input"]');
            
            // Test input functionality
            await filterInput.click();
            await filterInput.type('test');
            await expect(filterInput).toHaveValue('test');
            
            // Test clear functionality
            await page.click('[data-testid="clear-filter"]');
            await expect(filterInput).toHaveValue('');
        });

        test('filter suggestions @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Filter Suggestions');
            allure.severity('normal');

            // Type partial text to trigger suggestions
            await page.fill('[data-testid="filter-input"]', 'err');
            
            // Wait for and verify suggestions
            const suggestions = page.locator('[data-testid="filter-suggestion"]');
            await expect(suggestions.first()).toBeVisible();
            
            // Click suggestion and verify filter
            await suggestions.first().click();
            await eventBrowserPage.waitForEventsToLoad();
        });
    });

    test.describe('Event Table Component', () => {
        test('column header interactions @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Column Headers');
            allure.severity('normal');

            // Test column header click for sorting
            const headers = page.locator('[data-testid="column-header"]');
            await headers.first().click();
            
            // Verify sort indicator
            await expect(page.locator('[data-testid="sort-indicator"]')).toBeVisible();
            
            // Test reverse sort
            await headers.first().click();
            await expect(page.locator('[data-testid="sort-indicator"].desc')).toBeVisible();
        });

        test('row selection and bulk actions @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Row Selection');
            allure.severity('normal');

            // Select multiple rows
            const checkboxes = page.locator('[data-testid="row-checkbox"]');
            await checkboxes.first().click();
            await checkboxes.nth(1).click();
            
            // Verify bulk action menu
            await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible();
            
            // Test bulk export
            await page.click('[data-testid="bulk-export"]');
            await page.click('[data-testid="export-selected-csv"]');
            await page.waitForEvent('download');
        });
    });

    test.describe('Pagination Component', () => {
        test('pagination controls behavior @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Pagination');
            allure.severity('normal');

            // Test page size selector
            await page.click('[data-testid="page-size-selector"]');
            await page.getByText('50').click();
            await eventBrowserPage.waitForEventsToLoad();
            
            // Test navigation buttons
            await page.click('[data-testid="next-page"]');
            await eventBrowserPage.waitForEventsToLoad();
            await page.click('[data-testid="previous-page"]');
            await eventBrowserPage.waitForEventsToLoad();
            
            // Test direct page input
            await page.fill('[data-testid="page-input"]', '2');
            await page.keyboard.press('Enter');
            await eventBrowserPage.waitForEventsToLoad();
        });

        test('pagination info display @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Pagination Info');
            allure.severity('normal');

            // Verify pagination info format
            const paginationInfo = page.locator('[data-testid="pagination-info"]');
            await expect(paginationInfo).toContainText('Showing');
            await expect(paginationInfo).toContainText('of');
            
            // Change page size and verify update
            await page.click('[data-testid="page-size-selector"]');
            await page.getByText('100').click();
            await eventBrowserPage.waitForEventsToLoad();
            await expect(paginationInfo).toContainText('100');
        });
    });

    test.describe('Event Details Component', () => {
        test('event details modal interaction @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Event Details Modal');
            allure.severity('normal');

            // Open event details
            await eventBrowserPage.openEventDetails(0);
            
            // Verify modal controls
            await expect(page.locator('[data-testid="modal-close"]')).toBeVisible();
            await expect(page.locator('[data-testid="modal-maximize"]')).toBeVisible();
            
            // Test maximize/minimize
            await page.click('[data-testid="modal-maximize"]');
            await expect(page.locator('[data-testid="modal-content"].maximized')).toBeVisible();
            
            // Test close
            await page.click('[data-testid="modal-close"]');
            await expect(page.locator('[data-testid="event-details"]')).toBeHidden();
        });

        test('event details content structure @components', async ({ page }) => {
            allure.epic('Monitoring');
            allure.feature('Event Browser Components');
            allure.story('Event Details Content');
            allure.severity('normal');

            // Open details and verify sections
            await eventBrowserPage.openEventDetails(0);
            
            // Verify all expected sections
            const sections = [
                'Event Information',
                'Source Details',
                'Additional Properties',
                'Raw Data'
            ];
            
            for (const section of sections) {
                await expect(page.getByText(section)).toBeVisible();
            }
            
            // Test section expansion/collapse
            await page.click('[data-testid="section-toggle"]');
            await expect(page.locator('[data-testid="section-content"]')).toBeHidden();
        });
    });
});