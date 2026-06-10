/**
 * Configuration for the PMXT widgets shadcn registry build.
 * REGISTRY_BASE_URL env var overrides the published base URL
 * (useful for local preview, e.g. http://localhost:3000).
 */

const DEFAULT_BASE_URL = 'https://widgets.pmxt.dev';

export const baseUrl = process.env.REGISTRY_BASE_URL || DEFAULT_BASE_URL;
export const name = 'pmxt-widgets';
export const homepage = 'https://widgets.pmxt.dev';

export default { baseUrl, name, homepage };
