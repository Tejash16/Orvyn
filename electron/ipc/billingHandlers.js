'use strict';

const { shell } = require('electron');
const authService    = require('../services/authService');
const expressService = require('../services/expressService');

/**
 * Registers billing-related IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 */
function registerBillingHandlers(ipcMain, getMainWindow) {

  /**
   * billing:upgrade — Create checkout session and open in system browser.
   * @param {{ plan: 'pro' | 'enterprise', organizationId?: string, seats?: number }} payload
   */
  ipcMain.handle('billing:upgrade', async (_event, { plan, organizationId, seats }) => {
    try {
      const token = authService.getToken();
      if (!token) return { success: false, error: 'Not authenticated' };

      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan, organizationId, seats }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create checkout session' };
      }

      if (data.checkoutUrl) {
        // Open Razorpay-hosted checkout page in system browser
        await shell.openExternal(data.checkoutUrl);
        return { success: true, subscriptionId: data.subscriptionId };
      }

      return { success: false, error: data.error || 'No checkout URL received' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * billing:status — Get current subscription status from Express.
   */
  ipcMain.handle('billing:status', async () => {
    try {
      const token = authService.getToken();
      if (!token) return { plan: 'free', status: 'active' };

      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/billing/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) return { plan: 'free', status: 'active' };

      return await res.json();
    } catch {
      return { plan: 'free', status: 'active' };
    }
  });

  /**
   * billing:cancel — Cancel the user's active subscription.
   */
  ipcMain.handle('billing:cancel', async () => {
    try {
      const token = authService.getToken();
      if (!token) return { success: false, error: 'Not authenticated' };

      const res = await fetch(`${expressService.getExpressUrl()}/api/v1/billing/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to cancel subscription' };
      }

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerBillingHandlers };
