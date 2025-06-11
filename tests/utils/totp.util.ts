import { authenticator } from 'otplib';
import * as CryptoJS from 'crypto-js';

export class TOTPUtil {
    private static readonly encryptionKey = process.env.TOTP_ENCRYPTION_KEY || 'your-encryption-key';
    private static encryptedSecret: string | null = null;
    private static readonly storageKey = 'playwright_totp_secret';

    /**
     * Encrypts the TOTP secret
     */
    private static encryptSecret(secret: string): string {
        return CryptoJS.AES.encrypt(secret, this.encryptionKey).toString();
    }

    /**
     * Decrypts the TOTP secret
     */
    private static decryptSecret(encryptedSecret: string): string {
        const bytes = CryptoJS.AES.decrypt(encryptedSecret, this.encryptionKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    /**
     * Securely stores the TOTP secret
     */
    static setSecret(secret: string): void {
        // Validate secret before storing
        if (!this.validateSecret(secret)) {
            throw new Error('Invalid TOTP secret format');
        }
        this.encryptedSecret = this.encryptSecret(secret);
        
        // Also store in global storage for persistence
        try {
            global[this.storageKey] = this.encryptedSecret;
        } catch (error) {
            console.warn('Failed to store TOTP secret in global storage:', error);
        }
    }

    /**
     * Validates if a secret key is in the correct format
     */
    static validateSecret(secret: string): boolean {
        return !!secret && secret.length >= 16; // Most TOTP secrets are at least 16 characters
    }

    /**
     * Generates a TOTP code
     */
    static generateTOTP(secret?: string): string {
        let totpSecret: string;

        try {
            if (secret) {
                totpSecret = secret;
                console.log('Using provided TOTP secret');
                // Store for future use if valid
                this.setSecret(secret);
            } else {
                // Try to get from class storage first, then global storage
                const storedSecret = this.encryptedSecret || global[this.storageKey];
                if (!storedSecret) {
                    throw new Error('No TOTP secret available');
                }
                
                totpSecret = this.decryptSecret(storedSecret);
                this.encryptedSecret = storedSecret; // Ensure it's stored in class storage
            }

            // Validate the secret before generating code
            if (!this.validateSecret(totpSecret)) {
                throw new Error('Invalid TOTP secret format');
            }

            return authenticator.generate(totpSecret);
        } catch (error) {
            console.error('Error generating TOTP:', error);
            throw error;
        }
    }

    /**
     * Clears the stored secret
     */
    static clearSecret(): void {
        this.encryptedSecret = null;
        try {
            delete global[this.storageKey];
        } catch (error) {
            console.warn('Failed to clear TOTP secret from global storage:', error);
        }
    }
}
