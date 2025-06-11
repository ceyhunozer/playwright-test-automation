import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Get current environment
  const environment = process.env.ENV || 'test';
  
  // Log environment information
  console.log(`Running tests in ${environment} environment`);
  console.log(`Base URL: ${config.projects[0].use.baseURL}`);
  console.log(`API URL: ${config.metadata.apiURL}`);
  
  // You can add additional setup logic here
  // For example: setting up test data, cleaning up previous test runs, etc.
}

export default globalSetup; 