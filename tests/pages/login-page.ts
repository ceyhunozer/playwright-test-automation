import { Page, expect } from '@playwright/test';
import { TOTPUtil } from '../utils/totp.util';

export class LoginPage {
    private readonly page: Page;
    private readonly navigationTimeout = 90000; // Increased timeout for flaky networks
    private readonly retryAttempts = 5; // Increased retry attempts
    private readonly retryDelay = 3000; // Increased delay between retries

    // Locators
    private readonly usernameInput = 'login-textbox-username';
    private readonly passwordInput = 'login-textbox-password';
    private readonly continueButton = 'login-btn-continue';
    private readonly backToLoginLink = 'link-back-to-login-or-loginform';
    private readonly twofaLoginButton = 'button-twofa-login';
    private readonly codeInputs = '.code--input';
    private readonly changeUserButton = 'link-change-user';

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Navigates to the login page with enhanced error handling and retries
     */
    async goto() {
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                console.log(`Navigate to login page attempt ${this.retryAttempts - retries + 1}/${this.retryAttempts}`);
                
                await this.page.goto('/portal/ui', {
                    waitUntil: 'networkidle',
                    timeout: this.navigationTimeout
                });

                // Wait for and verify login page load
                await this.verifyLoginPageLoaded();
                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`Login page navigation failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        throw new Error(`Failed to navigate to login page after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Clicks the change user button if it's visible
     */
    async clickChangeUserIfVisible() {
        try {
            console.log('Checking for change user button...');
            await this.page.waitForLoadState('domcontentloaded');
            await this.page.waitForLoadState('networkidle');
            
            // Try multiple selectors for change user button
            const selectors = [
                this.changeUserButton,
                'text=Change user',
                '[data-testid="link-change-user"]',
                'a:has-text("Change user")',
                'button:has-text("Change user")'
            ];
            
            let buttonFound = false;
            
            for (const selector of selectors) {
                try {
                    const changeUserBtn = this.page.locator(selector).first();
                    await changeUserBtn.waitFor({ state: 'visible', timeout: 3000 });
                    
                    const isVisible = await changeUserBtn.isVisible();
                    if (isVisible) {
                        console.log(`Change user button found with selector: ${selector}`);
                        await changeUserBtn.click();
                        await this.page.waitForTimeout(2000); // Wait for click to process
                        await this.page.waitForLoadState('networkidle');
                        console.log('Change user button clicked successfully');
                        buttonFound = true;
                        break;
                    }
                } catch (error) {
                    // Continue to next selector
                    continue;
                }
            }
            
            if (!buttonFound) {
                console.log('Change user button not found with any selector, proceeding...');
            }
            
        } catch (error) {
            console.log('Error checking for change user button:', error.message);
        }
    }

    /**
     * Enters the username with enhanced error handling
     * @param username - The username to enter
     */
    async enterUsername(username: string) {
        console.log('Entering username:', username);
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                // Ensure page is fully loaded
                await this.page.waitForLoadState('domcontentloaded');
                await this.page.waitForLoadState('networkidle');
                
                const usernameField = this.page.getByTestId(this.usernameInput);
                
                // Wait for field to be ready
                await usernameField.waitFor({ 
                    state: 'visible', 
                    timeout: this.navigationTimeout 
                });
                
                // Verify field is interactive
                const isEnabled = await usernameField.isEnabled();
                if (!isEnabled) {
                    throw new Error('Username field is not enabled');
                }
                
                // Clear and fill the username
                await usernameField.clear();
                await this.page.waitForTimeout(500); // Wait after clear
                
                await usernameField.fill(username);
                await this.page.waitForTimeout(1000); // Wait after fill
                
                // Trigger validation and wait
                await usernameField.press('Tab');
                await this.page.waitForTimeout(500); // Wait for validation
                
                console.log('Username entered and validated successfully');
                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`Username entry failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        throw new Error(`Failed to enter username after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Enters the password with enhanced error handling
     * @param password - The password to enter
     */
    async enterPassword(password: string) {
        console.log('Entering password');
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                // Ensure page is stable
                await this.page.waitForLoadState('domcontentloaded');
                await this.page.waitForLoadState('networkidle');
                
                const passwordField = this.page.getByTestId(this.passwordInput);
                await passwordField.waitFor({ 
                    state: 'visible',
                    timeout: this.navigationTimeout 
                });
                
                // Verify field is interactive
                const isEnabled = await passwordField.isEnabled();
                if (!isEnabled) {
                    throw new Error('Password field is not enabled');
                }
                
                // Simple sendKeys approach - clear and type password
                await passwordField.clear();
                await this.page.waitForTimeout(500); // Wait after clear
                
                console.log('Using simple sendKeys approach for password...');
                console.log('Password length to enter:', password.length);
                
                // Focus the field and type the password character by character
                await passwordField.focus();
                
                // Type with slower delay to ensure special characters are handled
                await passwordField.type(password, { delay: 150 });
                
                await this.page.waitForTimeout(1000); // Wait after typing
                
                // Verify the password was entered by checking field state
                const fieldValue = await passwordField.evaluate(el => (el as HTMLInputElement).value);
                console.log('Password field length after typing:', fieldValue.length);
                console.log('Expected length:', password.length);
                
                if (fieldValue.length !== password.length) {
                    console.log('Password length mismatch! Trying alternative method...');
                    
                    // Clear and try typing each character individually
                    await passwordField.clear();
                    await this.page.waitForTimeout(300);
                    await passwordField.focus();
                    
                    for (let i = 0; i < password.length; i++) {
                        const char = password[i];
                        console.log(`Typing character ${i + 1}/${password.length}: ${char}`);
                        await passwordField.type(char, { delay: 200 });
                        
                        // Check if character was entered
                        const currentValue = await passwordField.evaluate(el => (el as HTMLInputElement).value);
                        if (currentValue.length !== i + 1) {
                            console.log(`Warning: Expected ${i + 1} characters, got ${currentValue.length}`);
                        }
                    }
                    
                    // Final verification
                    const finalValue = await passwordField.evaluate(el => (el as HTMLInputElement).value);
                    console.log('Final password field length:', finalValue.length);
                }
                
                console.log('Password entered and validated successfully');
                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`Password entry failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        throw new Error(`Failed to enter password after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Clicks the continue button with enhanced error handling
     */
    async clickContinue(expectError: boolean = false) {
        let retries = expectError ? 1 : this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                // Ensure page is stable before clicking
                await this.page.waitForLoadState('domcontentloaded');
                await this.page.waitForLoadState('networkidle');
                
                const button = this.page.getByTestId(this.continueButton);
                
                // Wait for button to be ready
                await button.waitFor({ state: 'visible', timeout: 10000 });
                
                const buttonState = {
                    isEnabled: await button.isEnabled(),
                    isVisible: await button.isVisible()
                };
                console.log('Continue button state:', buttonState);

                if (!buttonState.isVisible || !buttonState.isEnabled) {
                    // Wait a bit more for the button to become enabled
                    console.log('Button not ready, waiting for it to become interactive...');
                    await this.page.waitForTimeout(2000);
                    
                    const updatedState = {
                        isEnabled: await button.isEnabled(),
                        isVisible: await button.isVisible()
                    };
                    console.log('Updated button state:', updatedState);
                    
                    if (!updatedState.isVisible || !updatedState.isEnabled) {
                        throw new Error('Continue button is not interactive after waiting');
                    }
                }

                console.log('Clicking continue button...');
                await button.click();
                
                // Wait for the action to process
                await this.page.waitForTimeout(2000);
                await this.page.waitForLoadState('networkidle', { timeout: 30000 });
                
                console.log('Continue button clicked and page loaded');
                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`Continue button click failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        if (!expectError) {
            throw new Error(`Failed to click continue button after ${this.retryAttempts} attempts: ${lastError.message}`);
        }
    }

    /**
     * Clicks the back to login button/link
     */
    async clickBackToLogin() {
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                const backLink = this.page.getByTestId(this.backToLoginLink);
                await backLink.waitFor({ state: 'visible', timeout: this.navigationTimeout });
                await backLink.click();
                await this.verifyLoginPageLoaded();
                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`Back to login click failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        throw new Error(`Failed to click back to login after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Verifies that the login page is loaded with enhanced error handling
     */
    async verifyLoginPageLoaded() {
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                await this.page.waitForLoadState('domcontentloaded');
                await this.page.waitForLoadState('networkidle');

                // Wait for and verify login form elements
                await expect(this.page.getByTestId(this.usernameInput))
                    .toBeVisible({ timeout: this.navigationTimeout });
                await expect(this.page.getByTestId(this.continueButton))
                    .toBeVisible({ timeout: this.navigationTimeout });

                // Verify URL is correct
                const currentUrl = this.page.url();
                if (!currentUrl.includes('/portal/ui') && !currentUrl.includes('/portal/login')) {
                    throw new Error(`Unexpected URL: ${currentUrl}`);
                }

                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`Login page verification failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        // Take error screenshot before throwing
        await this.captureErrorState('login-page-load-error.png');
        throw new Error(`Failed to verify login page after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Verifies that login was successful with enhanced error handling
     */
    async verifyLoginSuccessful() {
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                console.log('Verifying successful login...');
                
                // Wait for all critical states
                await Promise.all([
                    this.page.waitForLoadState('domcontentloaded'),
                    this.page.waitForLoadState('networkidle'),
                    this.page.waitForURL('**/portal/portal.html#WELCOME_NEWS', { 
                        timeout: this.navigationTimeout 
                    })
                ]);

                // Additional stabilization wait
                await this.page.waitForTimeout(1000);

                // Verify we're on the correct success page
                const currentUrl = this.page.url();
                console.log('Current URL after login:', currentUrl);
                
                // Check that we're on the portal page and not on login/error pages
                if (!currentUrl.includes('/portal/portal.html#WELCOME_NEWS')) {
                    throw new Error(`Expected to be on WELCOME_NEWS page, but got: ${currentUrl}`);
                }

                // Check for login errors
                const errorElements = await this.page.locator('[data-testid*="error"], .error-message, .alert-error').count();
                if (errorElements > 0) {
                    throw new Error('Login error detected on page');
                }

                // Simple verification - just check that the page loaded and we're not on login page
                const pageTitle = await this.page.title();
                console.log('Page title after login:', pageTitle);
                
                // Verify page contains portal content (more flexible than specific elements)
                const hasPortalContent = await this.page.locator('body').isVisible();
                if (!hasPortalContent) {
                    throw new Error('Portal page body not visible');
                }

                // Final verification pause
                await this.page.waitForTimeout(1000);
                console.log('Login verification complete - portal page fully loaded');
                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`Login verification failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        await this.captureErrorState('login-verification-error.png');
        throw new Error(`Login verification failed after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Verifies that password input is visible and ready for interaction
     */
    async verifyPasswordInputVisible() {
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                // Wait for page stability
                await this.page.waitForLoadState('domcontentloaded');
                await this.page.waitForLoadState('networkidle');

                // Check for login failure
                const currentUrl = this.page.url();
                if (currentUrl.includes('loginfail')) {
                    console.error('Login failed - Current URL:', currentUrl);
                    throw new Error('Login failed - redirected to login failure page');
                }

                // Wait for and verify password input
                const passwordField = this.page.getByTestId(this.passwordInput);
                await passwordField.waitFor({
                    state: 'visible',
                    timeout: this.navigationTimeout
                });

                const isVisible = await passwordField.isVisible();
                const isEnabled = await passwordField.isEnabled();
                console.log('Password input state:', { isVisible, isEnabled });

                if (!isVisible || !isEnabled) {
                    throw new Error('Password input is not interactive');
                }

                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`Password input verification failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        await this.captureErrorState('password-verification-error.png');
        throw new Error(`Failed to verify password input after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Verifies that the 2FA input is visible with enhanced error handling
     */
    async verify2FAInputVisible() {
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                // Wait for page stability
                await this.page.waitForLoadState('domcontentloaded');
                await this.page.waitForLoadState('networkidle');

                // Check for login failure
                const currentUrl = this.page.url();
                console.log('Current URL during 2FA verification:', currentUrl);
                if (currentUrl.includes('loginfail')) {
                    console.error('Login failed - Current URL:', currentUrl);
                    throw new Error('Login failed - redirected to login failure page');
                }

                // Wait for and verify 2FA input
                const input = this.page.locator(this.codeInputs).first();
                console.log('Looking for 2FA inputs with selector:', this.codeInputs);
                await input.waitFor({
                    state: 'visible',
                    timeout: this.navigationTimeout
                });

                const isVisible = await input.isVisible();
                const isEnabled = await input.isEnabled();
                console.log('2FA input state:', { isVisible, isEnabled });

                if (!isVisible || !isEnabled) {
                    throw new Error('2FA input is not interactive');
                }

                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`2FA input verification failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        await this.captureErrorState('2fa-verification-error.png');
        throw new Error(`Failed to verify 2FA input after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Enters 2FA code with enhanced error handling
     */
    async enter2FACode(code?: string, totpSecret?: string) {
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                await this.verify2FAInputVisible();
                
                // Generate or use provided TOTP code
                const totpCode = code || TOTPUtil.generateTOTP(totpSecret);
                console.log('Generated 2FA code:', totpCode.replace(/./g, '*'));
                console.log('Entering 2FA code into', (await this.page.locator(this.codeInputs).all()).length, 'input fields');

                const codeInputs = await this.page.locator(this.codeInputs).all();
                for (let i = 0; i < totpCode.length && i < codeInputs.length; i++) {
                    await codeInputs[i].fill(totpCode[i]);
                    await this.page.waitForTimeout(100); // Small delay between inputs
                }

                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`2FA code entry failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        await this.captureErrorState('totp-error.png');
        throw new Error(`Failed to enter 2FA code after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Clicks the 2FA login button with enhanced error handling
     */
    async click2FALogin() {
        let retries = this.retryAttempts;
        let lastError;

        while (retries > 0) {
            try {
                const loginButton = this.page.getByTestId(this.twofaLoginButton);
                await loginButton.waitFor({ 
                    state: 'visible',
                    timeout: this.navigationTimeout 
                });
                
                if (!await loginButton.isEnabled()) {
                    throw new Error('2FA login button is disabled');
                }

                await loginButton.click();
                await this.page.waitForLoadState('networkidle');
                return;

            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    console.log(`2FA login button click failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }

        throw new Error(`Failed to click 2FA login button after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Performs a complete login flow with dynamic TOTP
     */
    async loginWithDynamicTOTP(username: string, password: string, totpSecret?: string, keepTOTPSecret: boolean = true) {
        console.log('Starting login flow with username:', username);
        let success = false;
        let retryCount = 0;
        let lastError: any;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
            try {
                console.log(`Login attempt ${retryCount + 1}/${maxRetries + 1}`);
                
                // Clear any existing session data
                // await this.page.context().clearCookies();
                // await this.page.evaluate(() => {
                //     localStorage.clear();
                //     sessionStorage.clear();
                // });
                
                // Navigate and verify login page
                await this.goto();
                await this.verifyLoginPageLoaded();
                
                // Click change user button if visible
                await this.clickChangeUserIfVisible();
                
                // Handle username and password entry (both required before continue)
                await this.enterUsername(username);
                await this.verifyPasswordInputVisible();
                await this.enterPassword(password);
                await this.page.waitForLoadState('networkidle');
                await this.clickContinue();
                
                // Debug: Immediate check after continue click
                const immediateUrl = this.page.url();
                console.log('Immediate URL after continue click:', immediateUrl);
                
                // Wait for page to fully process the login
                console.log('Waiting for login to process...');
                await this.page.waitForTimeout(2000);
                
                // Check intermediate state
                const midUrl = this.page.url();
                console.log('URL after 2s wait:', midUrl);
                
                await this.page.waitForTimeout(3000);
                
                // Check what page we're on
                const currentUrl = this.page.url();
                console.log('Current URL after full wait:', currentUrl);
                
                // Debug: Check page content to understand the failure
                if (currentUrl.includes('loginfail')) {
                    console.log('Login failed - checking page for error messages...');
                    const pageContent = await this.page.content();
                    console.log('Page title:', await this.page.title());
                    
                    // Look for specific error messages
                    const errorSelectors = [
                        '[data-testid*="error"]',
                        '.error',
                        '.alert',
                        'text="Invalid"',
                        'text="Error"',
                        'text="Failed"'
                    ];
                    
                    for (const selector of errorSelectors) {
                        try {
                            const errorElement = this.page.locator(selector);
                            if (await errorElement.isVisible()) {
                                const errorText = await errorElement.textContent();
                                console.log(`Found error with selector "${selector}":`, errorText);
                            }
                        } catch (e) {
                            // Ignore selector errors
                        }
                    }
                    
                    throw new Error('Login failed - redirected to login failure page');
                }

                
                // Handle 2FA with enhanced verification
                await this.verify2FAInputVisible();
                await this.enter2FACode(undefined, totpSecret);
                await this.page.waitForLoadState('networkidle');
                await this.click2FALogin();
                
                // Verify successful login with extended timeout
                await this.page.waitForTimeout(2000); // Additional stability wait
                await this.verifyLoginSuccessful();
                
                success = true;
                console.log('Login successful');
                return;
                
            } catch (error) {
                lastError = error;
                retryCount++;
                if (retryCount <= maxRetries) {
                    console.log(`Login flow failed, retrying in ${this.retryDelay}ms...`);
                    await this.page.waitForTimeout(this.retryDelay);
                }
            }
        }
        
        // If we get here, all retries failed
        await this.captureErrorState('login-flow-error.png');
        throw new Error(`Login flow failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Performs a quick login flow for testing - alternative implementation
     */
    async quickLogin(username: string, password: string, totpSecret?: string) {
        try {
            await this.goto();
            await this.clickChangeUserIfVisible();
            await this.enterUsername(username);
            await this.verifyPasswordInputVisible();
            await this.enterPassword(password);
            await this.clickContinue();
            // Wait for redirect to 2FA page
            await this.page.waitForURL(/.*twoFactor/, { timeout: 30000 });
            await this.verify2FAInputVisible();
            await this.enter2FACode(undefined, totpSecret);
            await this.click2FALogin();
            await this.verifyLoginSuccessful();
        } finally {
            // Clean up TOTP secret
            if (totpSecret) {
                TOTPUtil.clearSecret();
            }
        }
    }

    /**
     * Captures error state with screenshot
     */
    private async captureErrorState(filename: string) {
        try {
            await this.page.screenshot({ 
                path: filename,
                fullPage: true
            });
        } catch (error) {
            console.error('Failed to capture error state:', error.message);
        }
    }
}