import { test as base } from '@playwright/test';
import { Environment, EnvConfig, getConfig } from './config';

// Create a test fixture with environment configuration
export const test = base.extend<{ envConfig: EnvConfig }>({
  envConfig: async ({}, use) => {
    const environment = (process.env.TEST_ENV as Environment) || 'test';
    const envConfig = getConfig(environment);

    console.log('Environment config loaded:', {
      environment: envConfig.environment,
      baseURL: envConfig.baseURL,
      apiURL: envConfig.apiURL,
      username: envConfig.credentials.username
    });
    
    await use(envConfig);
  }
});