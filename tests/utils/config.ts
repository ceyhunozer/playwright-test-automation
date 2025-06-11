import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file in the project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

export type Environment = 'test' | 'staging' | 'prod';

interface EnvironmentConfig {
  baseURL: string;
  apiURL: string;
  credentials: {
    username: string;
    password: string;
    totpSecret?: string;
  };
}

export interface EnvConfig extends EnvironmentConfig {
  environment: Environment;
  isTestEnv: boolean;
  isStagingEnv: boolean;
  isProdEnv: boolean;
}

// Environment specific configurations
export const environmentConfig: Record<Environment, EnvironmentConfig> = {
  test: {
    baseURL: process.env.BASE_URL || 'https://qa.osapiens.cloud',
    apiURL: process.env.API_URL || 'https://qa-api.osapiens.cloud',
    credentials: {
      username: process.env.TEST_USERNAME || 'yasin.tazeoglu@osapiens.com',
      password: process.env.TEST_PASSWORD || '~Wxok##JFqY1mXt'
    }
  },
  staging: {
    baseURL: process.env.STAGING_URL || 'https://staging.osapiens.cloud',
    apiURL: process.env.STAGING_API_URL || 'https://staging-api.osapiens.cloud',
    credentials: {
      username: process.env.STAGING_USERNAME || '',
      password: process.env.STAGING_PASSWORD || ''
    }
  },
  prod: {
    baseURL: process.env.PROD_URL || 'https://osapiens.cloud',
    apiURL: process.env.PROD_API_URL || 'https://api.osapiens.cloud',
    credentials: {
      username: process.env.PROD_USERNAME || '',
      password: process.env.PROD_PASSWORD || ''
    }
  }
};

export function getConfig(environment: Environment = 'test'): EnvConfig {
  const config = environmentConfig[environment];
  
  if (!config) {
    throw new Error(`Environment ${environment} not found in configuration`);
  }

  return {
    ...config,
    environment,
    isTestEnv: environment === 'test',
    isStagingEnv: environment === 'staging',
    isProdEnv: environment === 'prod'
  };
}
