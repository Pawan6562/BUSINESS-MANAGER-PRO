import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function initializeNotifications() {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Notification permissions not granted');
      return;
    }

    // Set notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7F',
      });
    }
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}

export async function sendLowStockNotification(productName: string, currentQuantity: number) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Low Stock Alert',
        body: `${productName} is running low (${currentQuantity} units remaining)`,
        data: {
          type: 'low_stock',
          productName,
        },
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

export async function sendOutOfStockNotification(productName: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Out of Stock',
        body: `${productName} is out of stock!`,
        data: {
          type: 'out_of_stock',
          productName,
        },
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

export async function sendSaleNotification(totalAmount: number, itemCount: number, currency: string = '$') {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Sale Completed',
        body: `${itemCount} item(s) sold for ${currency}${totalAmount.toFixed(2)}`,
        data: {
          type: 'sale_completed',
        },
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

export async function sendDailyReportNotification(totalSales: number, totalExpenses: number, profit: number, currency: string = '$') {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Daily Report',
        body: `Sales: ${currency}${totalSales.toFixed(2)} | Expenses: ${currency}${totalExpenses.toFixed(2)} | Profit: ${currency}${profit.toFixed(2)}`,
        data: {
          type: 'daily_report',
        },
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

export function addNotificationResponseListener(callback: (notification: Notifications.Notification) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    callback(response.notification);
  });
}
