import { test } from './utils/env-config';
import { expect } from '@playwright/test';
import { LoginPage } from './pages/login-page';
import { TOTPUtil } from './utils/totp.util';
import { allure } from 'allure-playwright';

// TOTP configuration for test environment authentication
const TOTP_SECRET = 'GHBAMSEXL7DOEWCE';

test.describe('Login Feature', () => {
    let loginPage: LoginPage;

    test.beforeEach(async ({ page, envConfig }) => {
        // Initialize TOTP authentication for 2FA
        TOTPUtil.setSecret(TOTP_SECRET);
        console.log('TOTP secret set:', TOTPUtil.validateSecret(TOTP_SECRET));

        // Initialize login page and verify environment setup
        loginPage = new LoginPage(page);
        console.log(`Test Configuration:
            Environment: ${envConfig.environment}
            Base URL: ${envConfig.baseURL}
            Username: ${envConfig.credentials.username}
        `);
        
        // Navigate to login page and ensure it's ready for testing
        await loginPage.goto();
        await loginPage.verifyLoginPageLoaded();
    });

    test.afterEach(async () => {
        // Clean up sensitive authentication data
        TOTPUtil.clearSecret();
    });

    test('Complete login flow with 2FA @smoke @critical', async ({ envConfig }) => {
        allure.epic('Authentication');
        allure.feature('Login');
        allure.story('2FA Login');
        allure.severity('critical');

        // Testing the optimized login flow with 2FA
        // This is the primary happy path that users will follow
        console.log('Testing quick login flow with 2FA...');
        await loginPage.loginWithDynamicTOTP(
            envConfig.credentials.username,
            envConfig.credentials.password
        );

        // Verify successful authentication and proper redirection
        await loginPage.verifyLoginSuccessful();
    });

    test('Step by step login process @regression', async ({ envConfig }) => {
        allure.epic('Authentication');
        allure.feature('Login');
        allure.story('Step-by-Step Login');
        allure.severity('normal');

        console.log('Testing detailed step-by-step login flow...');
        
        // Step 1: Initial username entry and verification
        // This tests the first stage of the multi-step login process
        await loginPage.enterUsername(envConfig.credentials.username);
        await loginPage.clickContinue();
        
        // Step 2: Testing the "Change User" functionality
        // Ensures users can restart the login process if needed
        await loginPage.clickBackToLogin();
        await loginPage.verifyLoginPageLoaded();
        
        // Step 3: Complete credential entry
        // Verifies the full credential submission process
        await loginPage.enterUsername(envConfig.credentials.username);
        await loginPage.verifyPasswordInputVisible();
        await loginPage.enterPassword(envConfig.credentials.password);
        await loginPage.clickContinue();
        
        // Step 4: 2FA Authentication
        // Validates the TOTP-based two-factor authentication flow
        await loginPage.verify2FAInputVisible();
        await loginPage.enter2FACode();
        await loginPage.click2FALogin();
        
        // Step 5: Final verification
        // Ensures the entire authentication flow completes successfully
        await loginPage.verifyLoginSuccessful();
    });

    test('Invalid credentials test @regression', async ({ page, envConfig }) => {
        allure.epic('Authentication');
        allure.feature('Login');
        allure.story('Invalid Login');
        allure.severity('normal');

        // Scenario 1: Testing login with invalid username but valid password
        // This verifies that the system properly rejects non-existent users
        // even when they provide a valid password format
        console.log('Testing login with invalid username...');
        await loginPage.enterUsername('invalid@example.com');
        await loginPage.verifyPasswordInputVisible();
        await loginPage.enterPassword(envConfig.credentials.password);
        await loginPage.clickContinue(true);

        // Verify that:
        // 1. User is redirected to login failure page
        // 2. 2FA input is not shown (system should reject before 2FA stage)
        await expect(page).toHaveURL(/.*loginfail/);
        await expect(page.locator('[data-testid="totp-input"]')).not.toBeVisible();

        // Return to login page to test next scenario
        await loginPage.clickBackToLogin();
        await loginPage.verifyLoginPageLoaded();
        
        // Scenario 2: Testing login with valid username but invalid password
        // This verifies that the system properly rejects valid users
        // when they provide incorrect passwords
        console.log('Testing login with invalid password...');
        await loginPage.enterUsername(envConfig.credentials.username);
        await loginPage.verifyPasswordInputVisible();
        await loginPage.enterPassword('wrongpassword123!');
        await loginPage.clickContinue(true);

        // Verify that:
        // 1. User is redirected to login failure page
        // 2. 2FA input is not shown (system should reject before 2FA stage)
        await expect(page).toHaveURL(/.*loginfail/);
        await expect(page.locator('[data-testid="totp-input"]')).not.toBeVisible();
    });
});