import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'EU Shield - GDPR Compliance Checker',
    description: 'Checks whether online services are EU/EEA-based',
    version: '1.0.0',
    permissions: ['storage', 'activeTab'],
    action: {
      default_popup: 'popup/index.html',
      default_icon: {
        '16': 'icon-grey-16.png',
        '32': 'icon-grey-32.png',
        '48': 'icon-grey-48.png',
        '128': 'icon-grey-128.png'
      }
    },
    icons: {
      '16': 'icon-grey-16.png',
      '32': 'icon-grey-32.png',
      '48': 'icon-grey-48.png',
      '128': 'icon-grey-128.png'
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.ts'],
        run_at: 'document_idle'
      }
    ]
  }
});
