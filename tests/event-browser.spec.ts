import { test as baseTest } from './utils/env-config';
import { expect } from '@playwright/test';
import { LoginPage } from './pages/login-page';
import { EventBrowserPage } from './pages/event-browser-page';
import { TOTPUtil } from './utils/totp.util';
import { allure } from 'allure-playwright';

// Use the same TOTP secret that works in login tests
const TOTP_SECRET = 'GHBAMSEXL7DOEWCE';

const test = baseTest;

test.describe('Event Browser', () => {
    let loginPage: LoginPage;
    let eventBrowserPage: EventBrowserPage;

    // Increase timeout for the entire test
    test.setTimeout(120000);

    test.beforeEach(async ({ page, envConfig }) => {
        // Initialize pages
        loginPage = new LoginPage(page);
        eventBrowserPage = new EventBrowserPage(page);

        console.log('Starting Event Browser test setup...');

        // Increase timeouts for login and navigation
        page.setDefaultTimeout(90000);

        try {
            // Initialize TOTP and login
            TOTPUtil.setSecret(TOTP_SECRET);
            await loginPage.goto();
            await loginPage.loginWithDynamicTOTP(
                envConfig.credentials.username,
                envConfig.credentials.password
            );

            // Add additional verification attempts
            let loginVerified = false;
            for (let i = 0; i < 3; i++) {
                try {
                    await loginPage.verifyLoginSuccessful();
                    loginVerified = true;
                    break;
                } catch (e) {
                    if (i < 2) {
                        console.log(`Login verification attempt ${i + 1} failed, retrying...`);
                        await page.waitForTimeout(2000);
                    }
                }
            }

            if (!loginVerified) {
                throw new Error('Failed to verify login after multiple attempts');
            }

            // Navigate to portal UI with retry logic
            for (let i = 0; i < 3; i++) {
                try {
                    await page.goto('https://qa.osapiens.cloud/portal/ui#/');

                    // Wait for main app shell to load and React hydration
                    console.log('Waiting for Portal UI to load...');
                    await Promise.all([
                        page.waitForLoadState('networkidle', { timeout: 30000 }),
                        page.waitForLoadState('domcontentloaded', { timeout: 30000 })
                    ]);
                    break;
                } catch (e) {
                    if (i < 2) {
                        console.log(`Portal navigation attempt ${i + 1} failed, retrying...`);
                        await page.waitForTimeout(2000);
                    } else {
                        throw e;
                    }
                }
            }

            // Enhanced waiting for app shell
            await page.waitForTimeout(2000);

            // Wait for and verify sidebar navigation
            const sidebarNav = page.locator('nav').first();
            await sidebarNav.waitFor({ state: 'visible', timeout: 30000 });
            
            // Click monitoring menu with retry
            const menuButtons = sidebarNav.locator('button');
            await menuButtons.nth(2).click({ timeout: 30000 });

            // Wait for and click Event Browser option
            const eventBrowserOption = page.getByText('Event browser');
            await eventBrowserOption.waitFor({ state: 'visible', timeout: 30000 });
            await eventBrowserOption.click();

            // Enhanced page load verification
            await Promise.all([
                page.waitForURL('**/monitoring-usage/monitoring-event-browser**', { timeout: 30000 }),
                page.waitForLoadState('networkidle', { timeout: 30000 })
            ]);

            // Additional wait for UI stabilization
            await page.waitForTimeout(2000);
            
        } catch (error) {
            console.error('Test setup failed:', error);
            await page.screenshot({ path: './test-results/setup-error.png', fullPage: true });
            throw error;
        }
    });

    test('Page Layout and Elements @smoke', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Page Layout and Elements');
        allure.severity('critical');

        // Header elements
        const headerSection = page.locator('[data-testid="event-browser-page-header"]');
        await expect(headerSection).toBeVisible();

        const messageByIdButton = page.locator('[data-testid="event-browser-page-header-messagebyid-button"]');
        await expect(messageByIdButton).toBeVisible();
        await expect(messageByIdButton).toHaveText('Message By ID');

        // Form elements
        const searchButton = page.locator('[data-testid="event-browser-page-search-button"]');
        await expect(searchButton).toBeVisible();
        await expect(searchButton).toHaveText('Search');

        const resetAllButton = page.locator('[data-testid="event-browser-page-reset-all-button"]');
        await expect(resetAllButton).toBeVisible();
        await expect(resetAllButton).toHaveText('Reset All');

        // Side menu tabs
        const sideMenuTabs = page.locator('[data-testid="event-browser-page-side-menu-tabs"]');
        await expect(sideMenuTabs).toBeVisible();

        // Verify all tab options
        const expectedTabs = ['General', 'Keys', 'Adv. Filters'];
        for (const tab of expectedTabs) {
            await expect(page.locator('button[role="tab"]', { hasText: tab })).toBeVisible();
        }

        // Form input fields
        const searchQueryField = page.locator('[data-testid="event-browser-page-side-menu-query-field"] input');
        await expect(searchQueryField).toBeVisible();
        await expect(searchQueryField).toHaveAttribute('placeholder', 'Search query');

        const hostField = page.locator('[data-testid="event-browser-page-side-menu-host-field"] input');
        await expect(hostField).toBeVisible();
        await expect(hostField).toHaveAttribute('placeholder', 'Host');

        const trackingKeyField = page.locator('[data-testid="event-browser-page-side-menu-trackingKey-field"] input');
        await expect(trackingKeyField).toBeVisible();
        await expect(trackingKeyField).toHaveAttribute('placeholder', 'Tracking key');

        const additionalIndexField = page.locator('[data-testid="event-browser-page-side-menu-additionalIndex-field"] input');
        await expect(additionalIndexField).toBeVisible();
        await expect(additionalIndexField).toHaveAttribute('placeholder', 'Index value');

        // Initial state message
        await expect(page.locator('h5.MuiTypography-h5')).toHaveText('Apply filters to start!');
        await expect(page.locator('p.MuiTypography-body1')).toHaveText('No events to show. Apply filters and/or press search to start.');
    });

    test('Time Range Selection @smoke', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Time Range Selection');
        allure.severity('critical');

        // Open time range picker
        const timeRangeButton = page.locator('[data-testid="event-browser-page-time-range-button"]');
        await timeRangeButton.click();

        // Verify time range menu appears
        const timeRangeMenu = page.locator('[data-testid="event-browser-page-time-range-menu"]');
        await expect(timeRangeMenu).toBeVisible();

        // Select Last 24 Hours
        const last24HoursOption = timeRangeMenu.locator('li', { hasText: 'Last 24 Hours' });
        await last24HoursOption.click();

        // Verify time range button text updates
        await expect(timeRangeButton).toContainText('Last 24 Hours');
    });

    test('Filter and Search Events @smoke', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Filter and Search');
        allure.severity('critical');

        // Set search query
        await page.locator('[data-testid="event-browser-page-side-menu-query-field"] input').fill('test message');

        // Set host filter
        await page.locator('[data-testid="event-browser-page-side-menu-host-field"] input').fill('test-host');

        // Click search button
        await page.locator('[data-testid="event-browser-page-search-button"]').click();

        // Wait for loading state
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).toBeVisible();
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).not.toBeVisible();

        // Reset all filters
        await page.locator('[data-testid="event-browser-page-reset-all-button"]').click();

        // Verify filters are cleared
        await expect(page.locator('[data-testid="event-browser-page-side-menu-query-field"] input')).toHaveValue('');
        await expect(page.locator('[data-testid="event-browser-page-side-menu-host-field"] input')).toHaveValue('');
    });

    test('Event Filtering @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Event Filtering');
        allure.severity('normal');

        // Test search functionality
        const filterInput = page.locator('input[placeholder*="Filter"]');
        
        // Filter by event type
        await filterInput.fill('error');
        await page.waitForLoadState('networkidle');
        
        // Verify filtered results
        const eventRows = page.locator('tr:not(:first-child)');
        await expect(eventRows.first()).toContainText(/error/i);

        // Clear filter
        await filterInput.clear();
        await page.waitForLoadState('networkidle');
    });

    test('Event Details View @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Event Details View');
        allure.severity('normal');

        // Click first event row
        const firstRow = page.locator('tr:not(:first-child)').first();
        await firstRow.click();

        // Verify detail panel opens
        const detailsPanel = page.locator('div[role="dialog"]');
        await expect(detailsPanel).toBeVisible();

        // Verify detail sections
        const detailSections = ['Event Details', 'Raw Event'];
        for (const section of detailSections) {
            await expect(page.getByText(section, { exact: true })).toBeVisible();
        }

        // Close details
        const closeButton = detailsPanel.locator('button[aria-label="Close"]');
        await closeButton.click();
        await expect(detailsPanel).not.toBeVisible();
    });

    test('Pagination @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Pagination');
        allure.severity('normal');

        // Verify pagination controls
        const paginationControls = page.locator('.pagination');
        await expect(paginationControls).toBeVisible();

        // Get initial page number
        const currentPage = page.locator('.pagination .current');
        await expect(currentPage).toHaveText('1');

        // Try to navigate to next page if available
        const nextButton = page.locator('button[aria-label="Next page"]');
        if (await nextButton.isEnabled()) {
            await nextButton.click();
            await page.waitForLoadState('networkidle');
            await expect(currentPage).toHaveText('2');

            // Go back to first page
            const prevButton = page.locator('button[aria-label="Previous page"]');
            await prevButton.click();
            await page.waitForLoadState('networkidle');
            await expect(currentPage).toHaveText('1');
        }
    });

    test('Message By ID Search @smoke', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Message By ID Search');
        allure.severity('critical');

        // Click Message By ID button
        await page.locator('[data-testid="event-browser-page-header-messagebyid-button"]').click();

        // Verify dialog opens
        const dialog = page.locator('[data-testid="event-browser-page-messagebyid-dialog"]');
        await expect(dialog).toBeVisible();

        // Type message ID
        const messageIdInput = dialog.locator('input');
        await messageIdInput.fill('test-message-id');

        // Click search button
        const searchButton = dialog.locator('button', { hasText: 'Search' });
        await searchButton.click();

        // Wait for loading state
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).toBeVisible();
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).not.toBeVisible();

        // Close dialog
        const closeButton = dialog.locator('button', { hasText: 'Close' });
        await closeButton.click();

        // Verify dialog is closed
        await expect(dialog).not.toBeVisible();
    });

    test('Advanced Filtering Capabilities @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Advanced Filtering');
        allure.severity('normal');

        // Switch to Advanced Filters tab
        const advFiltersTab = page.locator('button[role="tab"]', { hasText: 'Adv. Filters' });
        await advFiltersTab.click();

        // Add new condition
        const addConditionButton = page.locator('[data-testid="event-browser-page-add-condition-button"]');
        await addConditionButton.click();

        // Configure condition
        const fieldSelect = page.locator('[data-testid="event-browser-page-condition-field-select"]').first();
        await fieldSelect.click();
        await page.getByRole('option', { name: 'severity' }).click();

        const operatorSelect = page.locator('[data-testid="event-browser-page-condition-operator-select"]').first();
        await operatorSelect.click();
        await page.getByRole('option', { name: 'equals' }).click();

        const valueInput = page.locator('[data-testid="event-browser-page-condition-value-input"]').first();
        await valueInput.fill('ERROR');

        // Apply filters
        await page.locator('[data-testid="event-browser-page-search-button"]').click();

        // Verify loading state
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).toBeVisible();
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).not.toBeVisible();
    });

    test('Tab Switching and Content Verification @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Tab Navigation');
        allure.severity('normal');

        // Get all tabs
        const tabs = ['General', 'Keys', 'Adv. Filters'];
        
        for (const tab of tabs) {
            // Click tab
            const tabButton = page.locator('button[role="tab"]', { hasText: tab });
            await tabButton.click();
            
            // Verify tab is selected
            await expect(tabButton).toHaveAttribute('aria-selected', 'true');
            
            // Verify tab content is visible
            const tabPanel = page.locator(`[role="tabpanel"]`).filter({ hasText: tab });
            await expect(tabPanel).toBeVisible();

            // Verify specific content for each tab
            switch (tab) {
                case 'General':
                    await expect(page.locator('[data-testid="event-browser-page-side-menu-query-field"]')).toBeVisible();
                    await expect(page.locator('[data-testid="event-browser-page-side-menu-host-field"]')).toBeVisible();
                    break;
                case 'Keys':
                    await expect(page.locator('[data-testid="event-browser-page-side-menu-trackingKey-field"]')).toBeVisible();
                    await expect(page.locator('[data-testid="event-browser-page-side-menu-additionalIndex-field"]')).toBeVisible();
                    break;
                case 'Adv. Filters':
                    await expect(page.locator('[data-testid="event-browser-page-add-condition-button"]')).toBeVisible();
                    break;
            }
        }
    });

    test('Date Range Picker Functionality @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Date Range Selection');
        allure.severity('normal');

        // Open date range picker
        const dateRangeButton = page.locator('[data-testid="event-browser-page-time-range-button"]');
        await dateRangeButton.click();

        // Test predefined ranges
        const predefinedRanges = ['Last 15 Minutes', 'Last Hour', 'Last 24 Hours', 'Last 7 Days', 'Last 30 Days'];
        
        for (const range of predefinedRanges) {
            const rangeOption = page.locator('[data-testid="event-browser-page-time-range-menu"]')
                .locator('li', { hasText: range });
            await rangeOption.click();
            await expect(dateRangeButton).toContainText(range);

            // Open picker again for next iteration
            if (range !== predefinedRanges[predefinedRanges.length - 1]) {
                await dateRangeButton.click();
            }
        }

        // Test custom date range
        await dateRangeButton.click();
        const customRangeOption = page.locator('[data-testid="event-browser-page-time-range-menu"]')
            .locator('li', { hasText: 'Custom Range' });
        await customRangeOption.click();

        // Set custom range in the calendar
        const startDateInput = page.locator('[data-testid="event-browser-page-date-picker-start"]');
        const endDateInput = page.locator('[data-testid="event-browser-page-date-picker-end"]');

        await startDateInput.fill('2025-06-01 00:00');
        await endDateInput.fill('2025-06-11 23:59');

        // Apply custom range
        await page.locator('[data-testid="event-browser-page-date-picker-apply"]').click();

        // Verify custom range is applied
        await expect(dateRangeButton).toContainText('Custom Range');
    });

    test('Export Functionality @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Export');
        allure.severity('normal');

        // Perform a search to have data to export
        await page.locator('[data-testid="event-browser-page-side-menu-query-field"] input').fill('test');
        await page.locator('[data-testid="event-browser-page-search-button"]').click();

        // Wait for results
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).not.toBeVisible();

        // Click export button
        const exportButton = page.locator('[data-testid="event-browser-page-export-button"]');
        await exportButton.click();

        // Verify export options dialog
        const exportDialog = page.locator('[data-testid="event-browser-page-export-dialog"]');
        await expect(exportDialog).toBeVisible();

        // Select export format
        const formatSelect = exportDialog.locator('select');
        await formatSelect.selectOption('json');

        // Set export options
        const includeHeadersCheckbox = exportDialog.locator('input[type="checkbox"]').first();
        await includeHeadersCheckbox.check();

        // Click export
        const exportActionButton = exportDialog.locator('button', { hasText: 'Export' });
        
        // Start waiting for download before clicking
        const downloadPromise = page.waitForEvent('download');
        await exportActionButton.click();
        const download = await downloadPromise;

        // Verify download started
        expect(download.suggestedFilename()).toMatch(/export.*\.(json|csv)/);
    });

    test('Event List Sorting @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Sorting');
        allure.severity('normal');

        // Perform a search to have data to sort
        await page.locator('[data-testid="event-browser-page-side-menu-query-field"] input').fill('test');
        await page.locator('[data-testid="event-browser-page-search-button"]').click();

        // Wait for results
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).not.toBeVisible();

        // Test sorting for each sortable column
        const sortableColumns = ['Timestamp', 'Level', 'Message'];
        
        for (const column of sortableColumns) {
            // Click column header to sort ascending
            const columnHeader = page.locator('th', { hasText: column });
            await columnHeader.click();
            
            // Verify sort indicator
            await expect(columnHeader).toHaveAttribute('aria-sort', 'ascending');
            
            // Click again to sort descending
            await columnHeader.click();
            await expect(columnHeader).toHaveAttribute('aria-sort', 'descending');
        }
    });

    test('Error Handling @regression', async ({ page, context }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Error Handling');
        allure.severity('critical');

        // Test invalid message ID search
        await page.locator('[data-testid="event-browser-page-header-messagebyid-button"]').click();
        const dialog = page.locator('[data-testid="event-browser-page-messagebyid-dialog"]');
        await dialog.locator('input').fill('invalid-id-123');
        await dialog.locator('button', { hasText: 'Search' }).click();

        // Verify error message
        const errorMessage = page.locator('[data-testid="event-browser-page-error-message"]');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Message not found');

        // Close dialog
        await dialog.locator('button', { hasText: 'Close' }).click();

        // Test invalid date range
        await page.locator('[data-testid="event-browser-page-time-range-button"]').click();
        await page.locator('[data-testid="event-browser-page-time-range-menu"]')
            .locator('li', { hasText: 'Custom Range' }).click();

        // Set invalid date range (end date before start date)
        await page.locator('[data-testid="event-browser-page-date-picker-start"]').fill('2025-06-11 00:00');
        await page.locator('[data-testid="event-browser-page-date-picker-end"]').fill('2025-06-10 00:00');

        // Verify validation error
        const dateError = page.locator('[data-testid="event-browser-page-date-error"]');
        await expect(dateError).toBeVisible();
        await expect(dateError).toContainText('End date must be after start date');
    });

    test('Network Error Handling @regression', async ({ page, context }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Network Error');
        allure.severity('critical');

        // Simulate offline mode
        await context.setOffline(true);

        // Try to search
        await page.locator('[data-testid="event-browser-page-search-button"]').click();

        // Verify network error message
        const networkError = page.locator('[data-testid="event-browser-page-network-error"]');
        await expect(networkError).toBeVisible();
        await expect(networkError).toContainText('Network error');

        // Restore online mode
        await context.setOffline(false);

        // Verify error message disappears after going back online
        await expect(networkError).not.toBeVisible();
    });

    test('Multiple Advanced Filters @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Advanced Filtering');
        allure.severity('normal');

        // Switch to Advanced Filters tab
        await page.locator('button[role="tab"]', { hasText: 'Adv. Filters' }).click();

        // Add first condition
        await page.locator('[data-testid="event-browser-page-add-condition-button"]').click();
        await page.locator('[data-testid="event-browser-page-condition-field-select"]').first().click();
        await page.getByRole('option', { name: 'severity' }).click();
        await page.locator('[data-testid="event-browser-page-condition-operator-select"]').first().click();
        await page.getByRole('option', { name: 'equals' }).click();
        await page.locator('[data-testid="event-browser-page-condition-value-input"]').first().fill('ERROR');

        // Add second condition
        await page.locator('[data-testid="event-browser-page-add-condition-button"]').click();
        await page.locator('[data-testid="event-browser-page-condition-field-select"]').nth(1).click();
        await page.getByRole('option', { name: 'host' }).click();
        await page.locator('[data-testid="event-browser-page-condition-operator-select"]').nth(1).click();
        await page.getByRole('option', { name: 'contains' }).click();
        await page.locator('[data-testid="event-browser-page-condition-value-input"]').nth(1).fill('test');

        // Set condition group operator to AND
        const operatorToggle = page.locator('[data-testid="event-browser-page-condition-group-operator"]');
        await operatorToggle.click();
        await page.getByRole('option', { name: 'AND' }).click();

        // Apply filters
        await page.locator('[data-testid="event-browser-page-search-button"]').click();

        // Verify loading state
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).toBeVisible();
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).not.toBeVisible();

        // Remove conditions
        const removeButtons = page.locator('[data-testid="event-browser-page-remove-condition-button"]');
        await removeButtons.first().click();
        await removeButtons.first().click();
    });

    test('Column Visibility Toggle @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Column Management');
        allure.severity('normal');

        // Click column visibility toggle
        const columnToggleButton = page.locator('[data-testid="event-browser-page-column-toggle-button"]');
        await columnToggleButton.click();

        // Get list of available columns
        const columnList = page.locator('[data-testid="event-browser-page-column-list"]');
        await expect(columnList).toBeVisible();

        // Toggle some columns off
        const timestampToggle = columnList.locator('input[type="checkbox"]').filter({ hasText: 'Timestamp' });
        const levelToggle = columnList.locator('input[type="checkbox"]').filter({ hasText: 'Level' });

        // Get initial column count
        const initialColumnCount = await page.locator('th').count();

        // Toggle columns off
        await timestampToggle.uncheck();
        await levelToggle.uncheck();

        // Verify columns are hidden
        const updatedColumnCount = await page.locator('th').count();
        expect(updatedColumnCount).toBe(initialColumnCount - 2);

        // Toggle columns back on
        await timestampToggle.check();
        await levelToggle.check();

        // Verify columns are visible again
        const finalColumnCount = await page.locator('th').count();
        expect(finalColumnCount).toBe(initialColumnCount);
    });

    test('Input Field Validation @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Input Validation');
        allure.severity('normal');

        // Test max length validation
        const searchQueryField = page.locator('[data-testid="event-browser-page-side-menu-query-field"] input');
        const longString = 'a'.repeat(1000);
        await searchQueryField.fill(longString);
        
        // Verify input is truncated or shows error
        const actualValue = await searchQueryField.inputValue();
        expect(actualValue.length).toBeLessThan(1000);

        // Test special characters in host field
        const hostField = page.locator('[data-testid="event-browser-page-side-menu-host-field"] input');
        await hostField.fill('test@#$%^&*()host');
        
        // Verify input validation
        const hostError = page.locator('[data-testid="event-browser-page-host-field-error"]');
        await expect(hostError).toBeVisible();
        await expect(hostError).toContainText('Invalid characters');

        // Test tracking key format
        const trackingKeyField = page.locator('[data-testid="event-browser-page-side-menu-trackingKey-field"] input');
        await trackingKeyField.fill('invalid key format');
        
        // Verify tracking key validation
        const trackingKeyError = page.locator('[data-testid="event-browser-page-trackingKey-field-error"]');
        await expect(trackingKeyError).toBeVisible();
        await expect(trackingKeyError).toContainText('Invalid format');
    });

    test('Keyboard Navigation and Accessibility @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Accessibility');
        allure.severity('high');

        // Test tab navigation through major elements
        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="event-browser-page-header-messagebyid-button"]')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="event-browser-page-time-range-button"]')).toBeFocused();

        // Test keyboard shortcuts
        await page.keyboard.press('Control+f');
        await expect(page.locator('[data-testid="event-browser-page-side-menu-query-field"] input')).toBeFocused();

        // Test ARIA labels and roles
        const searchButton = page.locator('[data-testid="event-browser-page-search-button"]');
        await expect(searchButton).toHaveAttribute('role', 'button');
        await expect(searchButton).toHaveAttribute('aria-label', 'Search events');

        // Test screen reader accessibility
        const tableHeaders = page.locator('th[role="columnheader"]');
        await expect(tableHeaders).toHaveAttribute('aria-sort');

        // Test keyboard interaction with tabs
        const tabs = ['General', 'Keys', 'Adv. Filters'];
        for (const tab of tabs) {
            await page.keyboard.press('ArrowRight');
            const tabButton = page.locator('button[role="tab"]', { hasText: tab });
            await expect(tabButton).toBeFocused();
        }
    });

    test('Search History @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Search History');
        allure.severity('normal');

        // Perform multiple searches
        const searchQueries = ['error', 'warning', 'info'];
        const searchField = page.locator('[data-testid="event-browser-page-side-menu-query-field"] input');
        
        for (const query of searchQueries) {
            await searchField.fill(query);
            await page.locator('[data-testid="event-browser-page-search-button"]').click();
            await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).not.toBeVisible();
        }

        // Open search history
        await page.locator('[data-testid="event-browser-page-search-history-button"]').click();
        const historyPanel = page.locator('[data-testid="event-browser-page-search-history-panel"]');
        await expect(historyPanel).toBeVisible();

        // Verify history entries
        for (const query of searchQueries.reverse()) {
            const historyEntry = historyPanel.locator('li', { hasText: query });
            await expect(historyEntry).toBeVisible();
        }

        // Click history entry
        await historyPanel.locator('li').first().click();
        await expect(searchField).toHaveValue(searchQueries[searchQueries.length - 1]);
    });

    test('Event Details Content Validation @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Event Details');
        allure.severity('high');

        // Perform search to get events
        await page.locator('[data-testid="event-browser-page-side-menu-query-field"] input').fill('error');
        await page.locator('[data-testid="event-browser-page-search-button"]').click();
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).not.toBeVisible();

        // Open first event details
        const firstEvent = page.locator('tr:not(:first-child)').first();
        const eventText = await firstEvent.textContent();
        await firstEvent.click();

        // Verify details panel content
        const detailsPanel = page.locator('div[role="dialog"]');
        await expect(detailsPanel).toBeVisible();

        // Verify event data fields
        const expectedFields = ['Timestamp', 'Level', 'Message', 'Host', 'Tracking Key'];
        for (const field of expectedFields) {
            const fieldLabel = detailsPanel.locator('dt', { hasText: field });
            await expect(fieldLabel).toBeVisible();
            await expect(fieldLabel.locator('+ dd')).toBeVisible();
        }

        // Verify JSON view
        await detailsPanel.locator('button', { hasText: 'Raw Event' }).click();
        const jsonView = detailsPanel.locator('pre');
        await expect(jsonView).toBeVisible();
        const jsonContent = await jsonView.textContent();
        if (jsonContent) {
            expect(() => JSON.parse(jsonContent)).not.toThrow();
        }
    });

    test('Keyboard Shortcuts @regression', async ({ page }) => {
        allure.epic('Monitoring');
        allure.feature('Event Browser');
        allure.story('Keyboard Shortcuts');
        allure.severity('normal');

        // Test search shortcut
        await page.keyboard.press('Control+f');
        await expect(page.locator('[data-testid="event-browser-page-side-menu-query-field"] input')).toBeFocused();

        // Test refresh shortcut
        await page.keyboard.press('Control+r');
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).toBeVisible();
        await expect(page.locator('[data-testid="event-browser-page-loading-indicator"]')).not.toBeVisible();

        // Test message by ID shortcut
        await page.keyboard.press('Control+m');
        const messageDialog = page.locator('[data-testid="event-browser-page-messagebyid-dialog"]');
        await expect(messageDialog).toBeVisible();

        // Test escape to close dialogs
        await page.keyboard.press('Escape');
        await expect(messageDialog).not.toBeVisible();

        // Test tab navigation
        await page.keyboard.press('Control+1'); // Switch to General tab
        await expect(page.locator('button[role="tab"]', { hasText: 'General' }))
            .toHaveAttribute('aria-selected', 'true');

        await page.keyboard.press('Control+2'); // Switch to Keys tab
        await expect(page.locator('button[role="tab"]', { hasText: 'Keys' }))
            .toHaveAttribute('aria-selected', 'true');

        await page.keyboard.press('Control+3'); // Switch to Adv. Filters tab
        await expect(page.locator('button[role="tab"]', { hasText: 'Adv. Filters' }))
            .toHaveAttribute('aria-selected', 'true');

        // Test copy shortcut in event details
        await page.locator('tr:not(:first-child)').first().click();
        const detailsPanel = page.locator('div[role="dialog"]');
        await expect(detailsPanel).toBeVisible();
        
        await page.keyboard.press('Control+c');
        const copyConfirmation = page.locator('[data-testid="event-browser-page-copy-confirmation"]');
        await expect(copyConfirmation).toBeVisible();
        await expect(copyConfirmation).toHaveText('Event details copied to clipboard');
    });
});