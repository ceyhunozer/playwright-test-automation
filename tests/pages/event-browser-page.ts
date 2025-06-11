import { Page, expect } from '@playwright/test';

export class EventBrowserPage {
    private readonly page: Page;
    private readonly defaultTimeout = 30000;
    private readonly navigationTimeout = 45000; // Extended timeout for navigation

    // Locators
    private readonly timeRangeSelector = '[data-testid="time-range-selector"]';
    private readonly refreshButton = '[data-testid="refresh-button"]';
    private readonly eventTable = '[data-testid="event-table"]';
    private readonly eventRows = '[data-testid="event-row"]';
    private readonly filterInput = '[data-testid="filter-input"]';
    private readonly columnHeaders = '[data-testid="column-header"]';
    private readonly exportButton = '[data-testid="export-button"]';
    private readonly paginationControls = '[data-testid="pagination-controls"]';
    private readonly loadingSpinner = '[data-testid="loading-spinner"]';
    private readonly noDataMessage = '[data-testid="no-data-message"]';
    private readonly eventDetails = '[data-testid="event-details"]';

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Navigate to the Event Browser page with enhanced error handling
     */
    async goto() {
        try {
            console.log('Starting Event Browser page navigation...');
            
            // Set a long timeout for the initial navigation
            this.page.setDefaultTimeout(this.navigationTimeout);

            // Initial check for authentication state
            const currentUrl = this.page.url();
            if (currentUrl.includes('login') || currentUrl.includes('twoFactor')) {
                throw new Error('Not authenticated - redirected to login page');
            }

            // Navigate with waitUntil: 'networkidle' to ensure page is fully loaded
            console.log('Navigating to Event Browser URL...');
            await this.page.goto('/portal/ui#/monitoring-usage/monitoring-event-browser', {
                waitUntil: 'networkidle',
                timeout: this.navigationTimeout
            });

            // Verify we haven't been redirected to login
            const afterNavUrl = this.page.url();
            if (afterNavUrl.includes('login') || afterNavUrl.includes('twoFactor')) {
                console.error('Navigation failed - redirected to:', afterNavUrl);
                throw new Error('Lost authentication during navigation');
            }

            // Wait for critical UI elements with retry
            console.log('Waiting for page elements...');
            await this.retryOnError(async () => {
                await Promise.all([
                    this.page.waitForSelector(this.eventTable, { state: 'visible', timeout: this.navigationTimeout }),
                    this.page.waitForSelector(this.refreshButton, { state: 'visible', timeout: this.navigationTimeout }),
                    this.page.waitForSelector(this.timeRangeSelector, { state: 'visible', timeout: this.navigationTimeout })
                ]);
            }, 'Failed to load Event Browser UI elements', 2);

            // Verify loaded state
            await this.verifyPageLoaded();
            console.log('Event Browser page navigation successful');

        } catch (error) {
            console.error('Navigation error:', error);
            // Take error screenshot for debugging
            await this.page.screenshot({ path: 'event-browser-nav-error.png' });
            throw new Error(`Failed to navigate to Event Browser: ${error.message}`);
        } finally {
            // Reset timeout to default
            this.page.setDefaultTimeout(this.defaultTimeout);
        }
    }

    /**
     * Select a time range with retry logic
     */
    async selectTimeRange(range: string) {
        await this.retryOnError(async () => {
            await this.page.click(this.timeRangeSelector);
            await this.page.getByText(range).click();
            await this.waitForEventsToLoad();
        }, 'Failed to select time range');
    }

    /**
     * Refresh events with timeout handling
     */
    async refreshEvents() {
        await this.retryOnError(async () => {
            await this.page.click(this.refreshButton);
            await this.waitForEventsToLoad();
        }, 'Failed to refresh events');
    }

    /**
     * Filter events with validation
     */
    async filterEvents(searchTerm: string) {
        await this.retryOnError(async () => {
            await this.page.fill(this.filterInput, searchTerm);
            await this.waitForEventsToLoad();
        }, 'Failed to apply filter');
    }

    /**
     * Sort events by column
     * @param columnName - The name of the column to sort by
     */
    async sortByColumn(columnName: string) {
        const headers = await this.page.locator(this.columnHeaders);
        const header = headers.filter({ hasText: columnName });
        await header.click();
        await this.waitForEventsToLoad();
    }

    /**
     * Export events
     * @param format - The export format (e.g., 'csv', 'json')
     */
    async exportEvents(format: string) {
        await this.page.click(this.exportButton);
        await this.page.getByText(format).click();
        // Wait for download to start
        await this.page.waitForEvent('download');
    }

    /**
     * Navigate to a specific page
     * @param pageNumber - The page number to navigate to
     */
    async goToPage(pageNumber: number) {
        const pagination = this.page.locator(this.paginationControls);
        await pagination.getByText(String(pageNumber)).click();
        await this.waitForEventsToLoad();
    }

    /**
     * Open event details
     * @param eventIndex - The index of the event to open (0-based)
     */
    async openEventDetails(eventIndex: number) {
        const events = this.page.locator(this.eventRows);
        await events.nth(eventIndex).click();
        await this.page.locator(this.eventDetails).waitFor({ state: 'visible' });
    }

    /**
     * Wait for events to load and spinner to disappear
     */
    async waitForEventsToLoad(timeout = 30000) {
        try {
            // Wait for spinner to appear and disappear if it exists
            try {
                await this.page.waitForSelector(this.loadingSpinner, { state: 'visible', timeout: 5000 });
                await this.page.waitForSelector(this.loadingSpinner, { state: 'hidden', timeout });
            } catch (e) {
                // Spinner might not appear if data loads very quickly
                console.log('Loading spinner not found or already hidden');
            }

            // Wait for table or no-data message
            await Promise.race([
                this.page.waitForSelector(this.eventTable, { state: 'visible', timeout }),
                this.page.waitForSelector(this.noDataMessage, { state: 'visible', timeout })
            ]);
        } catch (error) {
            console.error('Failed to wait for events to load:', error);
            throw error;
        }
    }

    /**
     * Verify page is loaded with comprehensive checks
     */
    async verifyPageLoaded() {
        try {
            console.log('Verifying Event Browser page state...');
            
            // Check URL first
            const currentUrl = this.page.url();
            if (currentUrl.includes('login') || currentUrl.includes('twoFactor')) {
                throw new Error('Authentication lost - redirected to login');
            }

            // Verify portal frame elements are present
            await Promise.all([
                this.page.waitForSelector('[data-testid="portal-header"]', { 
                    state: 'visible',
                    timeout: 10000 
                }),
                this.page.waitForSelector('[data-testid="user-profile"]', { 
                    state: 'visible',
                    timeout: 10000 
                })
            ]);

            // Verify event browser specific elements
            await Promise.all([
                // Wait for main containers
                this.page.waitForSelector(this.eventTable, { 
                    state: 'visible',
                    timeout: 10000 
                }),
                // Wait for interactive elements
                this.page.waitForSelector(this.refreshButton, { 
                    state: 'visible',
                    timeout: 10000 
                }),
                this.page.waitForSelector(this.timeRangeSelector, { 
                    state: 'visible',
                    timeout: 10000 
                }),
                // Wait for network idle to ensure data is loaded
                this.page.waitForLoadState('networkidle', { 
                    timeout: 10000 
                })
            ]);

            // Verify no error states
            const errorMessage = this.page.locator('[data-testid="error-message"]');
            if (await errorMessage.isVisible()) {
                const error = await errorMessage.textContent();
                throw new Error(`Page loaded with error: ${error}`);
            }

            // Verify user session is active
            const userProfile = await this.page.locator('[data-testid="user-profile"]').textContent();
            if (!userProfile) {
                throw new Error('User session not properly loaded');
            }

            console.log('Event Browser page verified successfully');

        } catch (error) {
            console.error('Page verification error:', error);
            await this.page.screenshot({ path: 'event-browser-verify-error.png' });
            throw error;
        }
    }

    /**
     * Verifies that the Event Browser page is loaded and key elements are visible
     */
    async verifyEventBrowserLoaded() {
        console.log('Verifying Event Browser page loaded...');
        
        try {
            // Wait for any loading to complete
            await this.waitForEventsToLoad();

            // Verify essential UI elements with longer timeout
            const timeout = 30000;
            await Promise.all([
                this.page.waitForSelector(this.timeRangeSelector, { state: 'visible', timeout }),
                this.page.waitForSelector(this.filterInput, { state: 'visible', timeout }),
                this.page.waitForSelector(this.refreshButton, { state: 'visible', timeout })
            ]);

            // Take verification screenshot
            await this.page.screenshot({ 
                path: './test-results/event-browser-loaded.png',
                fullPage: false 
            });

            console.log('Event Browser page verification complete');
        } catch (error) {
            console.error('Failed to verify Event Browser page:', error);
            await this.page.screenshot({ 
                path: './test-results/event-browser-verification-failed.png',
                fullPage: true 
            });
            throw error;
        }
    }

    /**
     * Utility function to retry operations
     */
    private async retryOnError(operation: () => Promise<void>, errorMessage: string, maxRetries = 2) {
        for (let i = 0; i <= maxRetries; i++) {
            try {
                await operation();
                return;
            } catch (error) {
                if (i === maxRetries) {
                    throw new Error(`${errorMessage}: ${error.message}`);
                }
                console.log(`Retry ${i + 1}/${maxRetries} after error: ${error.message}`);
                await this.page.waitForTimeout(1000 * (i + 1));
            }
        }
    }

    /**
     * Get total number of events
     */
    async getEventCount(): Promise<number> {
        const events = this.page.locator(this.eventRows);
        return await events.count();
    }

    /**
     * Verify event details
     * @param expectedDetails - Object containing expected event details
     */
    async verifyEventDetails(expectedDetails: Record<string, string>) {
        const details = this.page.locator(this.eventDetails);
        for (const [key, value] of Object.entries(expectedDetails)) {
            await expect(details.getByText(value)).toBeVisible();
        }
    }
}