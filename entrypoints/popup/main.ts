import '@knadh/oat/oat.min.css';
import '@knadh/oat/oat.min.js';
import './style.css';
import { popupStore } from './store';
import { ExtensionMessage } from '../../lib/schemas';
import { z } from 'zod';

// Get current tab's domain
async function getActiveTabInfo(): Promise<{ domain: string; tabId: number } | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !tab.id) return null;
  try {
    const url = new URL(tab.url);
    return { domain: url.hostname, tabId: tab.id };
  } catch {
    return null;
  }
}

// Format confidence as percentage
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence)}%`;
}

// Format score with sign
function formatScore(score: number): string {
  return score >= 0 ? `+${score}` : score.toString();
}

// Get status badge class
function getStatusBadgeClass(status: 'green' | 'red' | 'grey'): string {
  return `badge ${status}`;
}

// Get status text
function getStatusText(status: 'green' | 'red' | 'grey'): string {
  const texts = {
    green: 'EU-Based',
    red: 'Non-EU',
    grey: 'Unknown'
  };
  return texts[status] || 'Unknown';
}

// Render signal details
function renderSignalDetails(signals: any[]): string {
  if (signals.length === 0) {
    return '<p class="no-signals">No specific signals detected</p>';
  }
  
  return signals.map(signal => `
    <div class="signal">
      <div class="signal-header">
        <span class="signal-label">${signal.label}</span>
        <span class="signal-weight ${signal.weight >= 0 ? 'positive' : 'negative'}">
          ${formatScore(signal.weight)}
        </span>
      </div>
      <div class="signal-description">${signal.description}</div>
      <div class="signal-meta">
        ${signal.matchCount} match(es) found
      </div>
    </div>
  `).join('');
}

// Update UI based on store state
function updateUI() {
  const appElement = document.getElementById('app');
  const state = popupStore.getState();
  
  if (!appElement) return;
  
  switch (state.state) {
    case 'idle':
      appElement.innerHTML = `
        <div class="popup-container">
          <div class="popup-header">
            <h1>EU Shield</h1>
            <p class="subtitle">EU Service Checker</p>
          </div>
          <div class="popup-content">
            <p>Analyzing website...</p>
          </div>
        </div>
      `;
      break;
    
    case 'loading':
      appElement.innerHTML = `
        <div class="popup-container">
          <div class="popup-header">
            <h1>EU Shield</h1>
            <p class="subtitle">Checking ${state.domain}</p>
          </div>
          <div class="popup-content">
            <div class="loading-spinner"></div>
            <p>Analyzing privacy policies...</p>
          </div>
        </div>
      `;
      break;
    
    case 'result':
      if (!state.result) break;
      
      appElement.innerHTML = `
        <div class="popup-container">
          <div class="popup-header">
            <h1>EU Shield</h1>
            <p class="subtitle">${state.domain}</p>
          </div>
          
          <div class="popup-content">
            <div class="status-section">
              <div class="status-badge ${getStatusBadgeClass(state.result.status)}">
                ${getStatusText(state.result.status)}
              </div>
              
              <div class="score-display">
                <span class="score-value">${formatScore(state.result.score)}</span>
                <span class="confidence">Confidence: ${formatConfidence(state.result.confidence)}</span>
              </div>
            </div>
            
            <div class="progress-meter">
              <div class="meter-bar" style="width: ${state.result.confidence}%"></div>
            </div>
            
            <div class="signals-section">
              <h3>Detected Signals (${state.result.signals.length}/15)</h3>
              <div class="signals-list">
                ${renderSignalDetails(state.result.signals)}
              </div>
            </div>
            
            <div class="actions">
              <button id="rescan-btn" class="button primary">Re-scan Page</button>
              <a href="${state.result.analyzedUrl}" target="_blank" class="button secondary">
                View Analyzed Page
              </a>
            </div>
          </div>
        </div>
      `;
      
      // Add event listener for rescan button
      const rescanBtn = document.getElementById('rescan-btn');
      if (rescanBtn) {
        rescanBtn.addEventListener('click', () => {
          const { domain, setRescanning, setError } = popupStore.getState();
          if (domain) {
            setRescanning();

            const message: z.infer<typeof ExtensionMessage> = {
              type: 'FORCE_RESCAN',
              domain
            };

            chrome.runtime.sendMessage(message, () => {
              if (chrome.runtime.lastError) {
                setError('Rescan failed. Please try again.');
                return;
              }
              pollForResult(domain);
            });
          }
        });
      }
      break;
    
    case 'error':
      appElement.innerHTML = `
        <div class="popup-container">
          <div class="popup-header">
            <h1>EU Shield</h1>
          </div>
          <div class="popup-content">
            <div class="error-message">
              <h3>Error</h3>
              <p>${state.error}</p>
              <button id="retry-btn" class="button primary">Try Again</button>
            </div>
          </div>
        </div>
      `;
      
      const retryBtn = document.getElementById('retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
          const { reset, setLoading, setError } = popupStore.getState();
          reset();

          const tabInfo = await getActiveTabInfo();
          if (!tabInfo) {
            setError('Cannot determine current page');
            return;
          }

          setLoading(tabInfo.domain);

          const message: z.infer<typeof ExtensionMessage> = {
            type: 'GET_RESULT',
            domain: tabInfo.domain
          };

          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              popupStore.getState().setError('Failed to retrieve result');
              return;
            }
            if (response) {
              popupStore.getState().setResult(response);
            } else {
              const checkMessage: z.infer<typeof ExtensionMessage> = {
                type: 'CHECK_PAGE',
                domain: tabInfo.domain
              };
              chrome.tabs.sendMessage(tabInfo.tabId, checkMessage, () => {
                if (chrome.runtime.lastError) {
                  popupStore.getState().setError('Page not scannable. Try refreshing.');
                  return;
                }
                pollForResult(tabInfo.domain);
              });
            }
          });
        });
      }
      break;
    
    case 'rescanning':
      appElement.innerHTML = `
        <div class="popup-container">
          <div class="popup-header">
            <h1>EU Shield</h1>
            <p class="subtitle">Re-scanning ${state.domain}</p>
          </div>
          <div class="popup-content">
            <div class="loading-spinner"></div>
            <p>Re-analyzing privacy policies...</p>
          </div>
        </div>
      `;
      break;
  }
}

// Poll background for cached result after triggering scan
function pollForResult(domain: string, attempts = 0): void {
  if (attempts >= 15) {
    popupStore.getState().setError('Scan timed out. Please try again.');
    return;
  }

  setTimeout(() => {
    const message: z.infer<typeof ExtensionMessage> = {
      type: 'GET_RESULT',
      domain
    };

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return;
      if (response) {
        popupStore.getState().setResult(response);
      } else {
        pollForResult(domain, attempts + 1);
      }
    });
  }, 1000);
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('EU Shield popup initialized');

  // Subscribe to store changes
  popupStore.subscribe(updateUI);

  // Get active tab info
  const tabInfo = await getActiveTabInfo();
  if (!tabInfo) {
    popupStore.getState().setError('Cannot determine current page');
    return;
  }

  const { domain, tabId } = tabInfo;
  const { setLoading, setResult, setError } = popupStore.getState();
  setLoading(domain);

  // Check cache first
  const message: z.infer<typeof ExtensionMessage> = {
    type: 'GET_RESULT',
    domain
  };

  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Message failed:', chrome.runtime.lastError);
      popupStore.getState().setError('Failed to load compliance data');
      return;
    }

    if (response) {
      popupStore.getState().setResult(response);
    } else {
      // No cached result — send CHECK_PAGE directly to the content script on the tab
      const checkMessage: z.infer<typeof ExtensionMessage> = {
        type: 'CHECK_PAGE',
        domain
      };

      chrome.tabs.sendMessage(tabId, checkMessage, (scanResponse) => {
        if (chrome.runtime.lastError) {
          console.error('Content script not available:', chrome.runtime.lastError);
          popupStore.getState().setError('Page not scannable. Try refreshing the page.');
          return;
        }
        // Content script will send SCAN_RESULT to background which caches it.
        // Poll until result is available.
        pollForResult(domain);
      });
    }
  });
});