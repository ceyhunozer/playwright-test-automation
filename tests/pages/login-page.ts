import { Page, expect } from '@playwright/test';
import { TOTPUtil } from '../utils/totp.util';export class LoginPage {
    private readonly page: Page;

    // Locators
    private readonly usernameInput = 'login-textbox-username';
    private readonly passwordInput = 'login-textbox-password';
    private readonly continueButton = 'login-btn-continue';
    private readonly backToLoginLink = 'link-back-to-login-or-loginform';
    private readonly twofaLoginButton = 'button-twofa-login';
    private readonly codeInputs = '.code--input';

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Navigates to the login page
     */
    async goto() {
        await this.page.goto('/portal/login', {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        await this.page.waitForTimeout(1000); // Wait for any redirect
    }

    /**
     * Enters the username
     * @param username - The username to enter
     */
    async enterUsername(username: string) {
        console.log('Entering username:', username);
        await this.page.waitForLoadState('domcontentloaded');
        const usernameField = this.page.getByTestId(this.usernameInput);
        
        // Wait with retry
        let retries = 3;
        while (retries > 0) {
            try {
                await usernameField.waitFor({ state: 'visible', timeout: 5000 });
                await usernameField.clear();
                await usernameField.fill(username);
                await usernameField.press('Tab'); // Trigger any validation
                break;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                await this.page.waitForTimeout(1000);
            }
        }
    }

    /**
     * Enters the password
     * @param password - The password to enter
     */
    async enterPassword(password: string) {
        console.log('Entering password');
        const passwordField = this.page.getByTestId(this.passwordInput);
        await passwordField.waitFor({ state: 'visible' });
        await passwordField.clear();
        await passwordField.fill(password);
        await passwordField.press('Tab'); // Trigger any validation
        await this.page.waitForTimeout(500); // Give time for validation
    }

    /**
     * Clicks the continue button and handles navigation
     */
    async clickContinue(expectFailure: boolean = false) {
        const button = this.page.getByTestId(this.continueButton);
        
        // Wait for button with retry logic
        let retries = 3;
        let isClicked = false;
        
        while (retries > 0 && !isClicked) {
            try {
                await this.page.waitForLoadState('domcontentloaded');
                await this.page.waitForLoadState('networkidle');
                
                // Wait for button or check if we're redirected
                try {
                    await button.waitFor({ state: 'visible', timeout: 5000 });
                } catch (error) {
                    // Check if we've been redirected
                    const currentUrl = this.page.url();
                    if (currentUrl.includes('portal.html')) {
                        console.log('Successfully redirected to portal');
                        return;
                    }
                    if (currentUrl.includes('loginfail')) {
                        if (expectFailure) {
                            console.log('Login failed as expected');
                            return;
                        }
                        throw new Error('Login failed - invalid credentials');
                    }
                    throw error;
                }
                
                const isEnabled = await button.isEnabled();
                console.log('Continue button state:', { isEnabled });
                
                if (!isEnabled) {
                    console.log('Button not enabled, retrying...');
                    retries--;
                    await this.page.waitForTimeout(1000);
                    continue;
                }
                
                await button.click();
                isClicked = true;
                
                // Wait for navigation
                await this.page.waitForLoadState('networkidle');
                
                // Check final URL
                const finalUrl = this.page.url();
                if (finalUrl.includes('loginfail')) {
                    if (expectFailure) {
                        console.log('Login failed as expected');
                        return;
                    }
                    throw new Error('Login failed - invalid credentials');
                }
                if (finalUrl.includes('portal.html')) {
                    console.log('Successfully redirected to portal');
                    return;
                }
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                console.log('Retrying click continue...', error.message);
                await this.page.waitForTimeout(1000);
            }
        }
    }

    /**
     * Clicks the back to login link
     */
    async clickBackToLogin() {
        const link = this.page.getByTestId(this.backToLoginLink);
        await link.waitFor({ state: 'visible' });
        await link.click();
    }

    /**
     * Handles the 2FA authentication step
     */
    async enter2FACode(code?: string, totpSecret?: string) {
        try {
            console.log('Starting 2FA code entry...');
            
            // Generate or use provided code
            const authCode = code || TOTPUtil.generateTOTP(totpSecret);
            if (!authCode || authCode.length !== 6) {
                throw new Error(`Invalid 2FA code format: ${authCode}`);
            }
            console.log('Generated valid 2FA code');

            // Wait for input fields with retry logic
            let retries = 3;
            let inputs: any[] = [];
            
            while (retries > 0) {
                try {
                    await this.page.waitForSelector(this.codeInputs, { 
                        state: 'visible',
                        timeout: 5000 
                    });
                    
                    inputs = await this.page.locator(this.codeInputs).all();
                    if (inputs.length !== 6) {
                        throw new Error(`Expected 6 input fields, found ${inputs.length}`);
                    }
                    
                    // Verify all inputs are interactive
                    for (const input of inputs) {
                        await expect(input).toBeVisible({ timeout: 5000 });
                        await expect(input).toBeEnabled({ timeout: 5000 });
                    }
                    
                    break;
                } catch (error) {
                    retries--;
                    console.log(`Retry ${3 - retries}/3: Waiting for 2FA inputs...`);
                    if (retries === 0) throw error;
                    await this.page.waitForTimeout(1000);
                }
            }

            // Split the code and enter digits
            const digits = authCode.split('');
            for (let i = 0; i < digits.length; i++) {
                await inputs[i].click(); // Ensure focus
                await inputs[i].fill(digits[i]);
                await expect(inputs[i]).toHaveValue(digits[i], { timeout: 5000 });
                await this.page.waitForTimeout(200); // Human-like delay
            }

            console.log('2FA code entered successfully');
        } catch (error) {
            console.error('Error entering 2FA code:', error);
            await this.page.screenshot({ path: 'totp-error.png' });
            throw error;
        }
    }

    /**
     * Clicks the 2FA login button
     */
    async click2FALogin() {
        const button = this.page.getByTestId(this.twofaLoginButton);
        
        // Wait for button to be both visible and enabled
        await this.page.waitForLoadState('networkidle');
        await button.waitFor({ state: 'visible' });
        await expect(button).toBeEnabled({ timeout: 15000 });
        
        // Click with retry logic
        await button.click();
        
        // Wait for navigation and check URL
        await this.page.waitForLoadState('networkidle');
        const currentUrl = this.page.url();
        
        // Check for successful login
        if (currentUrl.includes('portal.html')) {
            console.log('Successfully logged in with 2FA');
            return;
        }
        
        // Check for failure
        if (currentUrl.includes('loginfail')) {
            throw new Error('Login failed - invalid credentials');
        }
    }

    /**
     * Performs a complete login flow
     * @param username - The username to login with
     * @param password - The password to login with
     * @param twoFactorCode - The 6-digit 2FA code
     */    async login(username: string, password: string, twoFactorCode: string) {
        await this.enterUsername(username);
        await this.clickContinue();
        await this.clickBackToLogin();
        await this.enterUsername(username);
        await this.enterPassword(password);
        await this.clickContinue();
        await this.enter2FACode(twoFactorCode);
        await this.click2FALogin();
        await this.verifyLoginSuccessful();
    }

    /**
     * Verifies that the login page is loaded
     */
    async verifyLoginPageLoaded() {
        // Wait for URL to contain /portal/login
        await expect(this.page).toHaveURL(/.*\/portal\/login/);
        
        // Wait for login form elements
        await expect(this.page.getByTestId(this.usernameInput)).toBeVisible();
        await expect(this.page.getByTestId(this.continueButton)).toBeVisible();
    }

    /**
     * Verifies that the password input is visible
     */
    async verifyPasswordInputVisible() {
        await expect(this.page.getByTestId(this.passwordInput)).toBeVisible();
    }

    /**
     * Verifies that the 2FA input is visible
     */
    async verify2FAInputVisible() {
        // Wait for page to stabilize
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForLoadState('networkidle');
        
        // Check URL first
        const currentUrl = this.page.url();
        if (currentUrl.includes('loginfail')) {
            console.error('Login failed - Current URL:', currentUrl);
            throw new Error('Login failed - redirected to login failure page. Please check your credentials.');
        }

        // Take screenshot for debugging
        await this.page.screenshot({ path: 'login-page-debug.png' });

        try {
            // Wait for 2FA input with retry logic
            let retries = 3;
            while (retries > 0) {
                try {
                    const input = this.page.locator(this.codeInputs).first();
                    await input.waitFor({ 
                        state: 'visible',
                        timeout: 5000
                    });
                    
                    // Additional validation
                    const isVisible = await input.isVisible();
                    const isEnabled = await input.isEnabled();
                    console.log('2FA input state:', { isVisible, isEnabled });
                    
                    if (!isVisible || !isEnabled) {
                        throw new Error('2FA input is not interactive');
                    }
                    
                    console.log('2FA input field is visible and enabled');
                    return;
                } catch (error) {
                    retries--;
                    if (retries === 0) throw error;
                    await this.page.waitForTimeout(1000);
                }
            }
        } catch (error) {
            console.error('Error waiting for 2FA input:', error);
            // Take error screenshot
            await this.page.screenshot({ path: 'login-page-error.png' });
            throw new Error(`Failed to find 2FA input: ${error.message}`);
        }
    }

    /**
     * Verifies that login was successful and portal is accessible
     */
    async verifyLoginSuccessful(): Promise<void> {
        try {
            console.log('Verifying successful login and portal access...');

            // Wait for portal redirect with more flexible URL matching
            await this.page.waitForURL('**/portal/portal.html**', { timeout: 45000 });
            console.log('Portal URL verified');

            // Wait for the page to be fully loaded and interactive
            await this.page.waitForLoadState('networkidle', { timeout: 30000 });
            await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
            
            // Additional verification - check for portal elements
            await this.page.waitForSelector('button:has-text("Search")', { timeout: 30000 });
            console.log('Portal UI elements verified');
            
        } catch (error) {
            // Take a screenshot and re-throw with clear message
            await this.page.screenshot({ path: 'login-verification-error.png' });
            throw new Error(`Login verification failed: ${error.message}`);
        }
    }

    /**
     * Performs a complete login flow with dynamic TOTP
     */
    async loginWithDynamicTOTP(username: string, password: string, totpSecret?: string, keepTOTPSecret: boolean = true) {
        console.log('Starting login flow with username:', username);
        let success = false;
        
        try {
            // Ensure we're on the login page
            await this.goto();
            await this.verifyLoginPageLoaded();
            
            // Enter username with validation
            await this.enterUsername(username);
            await this.clickContinue();
            
            // Handle password entry
            await this.verifyPasswordInputVisible();
            await this.enterPassword(password);
            await this.clickContinue();
            
            // Wait for state after password entry
            await this.page.waitForLoadState('networkidle');
            const currentUrl = this.page.url();
            
            // Check if we need 2FA with retries
            let retries = 3;
            while (retries > 0) {
                try {
                    const currentUrl = this.page.url();
                    if (currentUrl.includes('twoFactor') || !currentUrl.includes('portal.html')) {
                        console.log('2FA required, proceeding with TOTP flow...');
                        await this.verify2FAInputVisible();
                        await this.enter2FACode(undefined, totpSecret);
                        await this.click2FALogin();
                        
                        // Wait for navigation after 2FA
                        await this.page.waitForLoadState('networkidle', { timeout: 30000 });
                        break;
                    } else if (currentUrl.includes('portal.html')) {
                        console.log('No 2FA required, already on portal');
                        break;
                    }
                } catch (error) {
                    retries--;
                    if (retries === 0) throw error;
                    console.log('Retrying 2FA check...');
                    await this.page.waitForTimeout(2000);
                }
            }
            
            // Final verification with increased timeout
            await this.verifyLoginSuccessful();
            success = true;
            
            // Wait for session to be fully established
            await this.page.waitForTimeout(2000);
            
        } catch (error) {
            console.error('Login flow failed:', error);
            await this.page.screenshot({ path: 'login-failure.png' });
            throw error;
        } finally {
            if (success && !keepTOTPSecret) {
                // Only clear TOTP secret if explicitly requested
                console.log('Login successful, clearing TOTP secret');
                TOTPUtil.clearSecret();
            }
        }
    }
}