import * as SecureStore from 'expo-secure-store';

export interface CivicAlert {
  id: string;
  type: 'VISA_GRANTED' | 'VISA_RECEIVED' | 'VISA_REVOKED' | 'SYSTEM_NOTICE';
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  relatedNpub?: string;
  relatedAlias?: string;
}

export class CivicAlertService {
  private static readonly STORAGE_KEY_PREFIX = 'amaratia_civic_alerts_';

  static async getAlerts(myNpub: string): Promise<CivicAlert[]> {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${myNpub.substring(0, 16)}`;
      const data = await SecureStore.getItemAsync(key);
      if (!data) return [];
      return JSON.parse(data) as CivicAlert[];
    } catch (e) {
      console.error('[CivicAlertService] Error reading alerts:', e);
      return [];
    }
  }

  static async addAlert(
    myNpub: string,
    alert: Omit<CivicAlert, 'id' | 'timestamp' | 'read'>
  ): Promise<CivicAlert> {
    try {
      const current = await this.getAlerts(myNpub);
      const newAlert: CivicAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        read: false,
        ...alert,
      };

      const updated = [newAlert, ...current].slice(0, 50);
      const key = `${this.STORAGE_KEY_PREFIX}${myNpub.substring(0, 16)}`;
      await SecureStore.setItemAsync(key, JSON.stringify(updated));
      return newAlert;
    } catch (e) {
      console.error('[CivicAlertService] Error adding alert:', e);
      return {
        id: `alert_${Date.now()}`,
        timestamp: Date.now(),
        read: false,
        ...alert,
      };
    }
  }

  static async hasUnreadAlerts(myNpub: string): Promise<boolean> {
    try {
      const current = await this.getAlerts(myNpub);
      return current.some((a) => !a.read);
    } catch {
      return false;
    }
  }

  static async markAllAsRead(myNpub: string): Promise<void> {
    try {
      const current = await this.getAlerts(myNpub);
      const updated = current.map(a => ({ ...a, read: true }));
      const key = `${this.STORAGE_KEY_PREFIX}${myNpub.substring(0, 16)}`;
      await SecureStore.setItemAsync(key, JSON.stringify(updated));
    } catch (e) {
      console.error('[CivicAlertService] Error marking alerts as read:', e);
    }
  }

  static async clearAlerts(myNpub: string): Promise<void> {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${myNpub.substring(0, 16)}`;
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error('[CivicAlertService] Error clearing alerts:', e);
    }
  }
}
