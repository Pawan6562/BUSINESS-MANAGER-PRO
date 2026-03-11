import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getAllProducts, getAllSales, getExpensesByDateRange } from './database';

export interface BackupData {
  version: string;
  timestamp: number;
  businessData: {
    products: any[];
    sales: any[];
    expenses: any[];
  };
}

/**
 * Create a backup of all app data
 */
export async function createBackup(): Promise<string> {
  try {
    const products = await getAllProducts();
    const sales = await getAllSales();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const expenses = await getExpensesByDateRange(startOfMonth, now.getTime());

    const backupData: BackupData = {
      version: '1.0.0',
      timestamp: Date.now(),
      businessData: {
        products,
        sales,
        expenses,
      },
    };

    const fileName = `grocery-backup-${new Date().toISOString().split('T')[0]}.json`;
    const filePath = `${FileSystem.documentDirectory || ''}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backupData, null, 2));

    return filePath;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw new Error('Failed to create backup');
  }
}

/**
 * Share backup file (uses native sharing)
 */
export async function shareBackup(filePath: string): Promise<void> {
  try {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Share Backup',
    });
  } catch (error) {
    console.error('Error sharing backup:', error);
    throw new Error('Failed to share backup');
  }
}

/**
 * Export data to JSON format
 */
export async function exportDataAsJSON(): Promise<string> {
  try {
    const backup = await createBackup();
    return backup;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

/**
 * Get list of backup files
 */
export async function getBackupFiles(): Promise<string[]> {
  try {
    const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory || '');
    return files.filter((file) => file.startsWith('grocery-backup-') && file.endsWith('.json'));
  } catch (error) {
    console.error('Error getting backup files:', error);
    return [];
  }
}

/**
 * Read backup file content
 */
export async function readBackupFile(fileName: string): Promise<BackupData> {
  try {
    const filePath = `${FileSystem.documentDirectory || ''}${fileName}`;
    const content = await FileSystem.readAsStringAsync(filePath);
    const backupData: BackupData = JSON.parse(content);
    return backupData;
  } catch (error) {
    console.error('Error reading backup file:', error);
    throw new Error('Failed to read backup file');
  }
}

/**
 * Delete backup file
 */
export async function deleteBackupFile(fileName: string): Promise<void> {
  try {
    const filePath = `${FileSystem.documentDirectory || ''}${fileName}`;
    await FileSystem.deleteAsync(filePath);
  } catch (error) {
    console.error('Error deleting backup file:', error);
    throw new Error('Failed to delete backup file');
  }
}

/**
 * Validate backup data structure
 */
export function validateBackupData(data: any): boolean {
  try {
    if (!data.version || !data.timestamp || !data.businessData) {
      return false;
    }

    const { products, sales, expenses } = data.businessData;

    if (!Array.isArray(products) || !Array.isArray(sales) || !Array.isArray(expenses)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get backup file size in MB
 */
export async function getBackupFileSize(fileName: string): Promise<number> {
  try {
    const filePath = `${FileSystem.documentDirectory || ''}${fileName}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists && fileInfo.size) {
      return fileInfo.size / (1024 * 1024); // Convert to MB
    }
    return 0;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
}

/**
 * Get backup file creation date
 */
export function getBackupFileDate(fileName: string): Date {
  try {
    const dateStr = fileName.replace('grocery-backup-', '').replace('.json', '');
    return new Date(dateStr);
  } catch {
    return new Date();
  }
}

/**
 * Format backup file info for display
 */
export async function formatBackupFileInfo(fileName: string): Promise<{
  name: string;
  date: string;
  size: string;
}> {
  const fileDate = getBackupFileDate(fileName);
  const fileSize = await getBackupFileSize(fileName);

  return {
    name: fileName,
    date: fileDate.toLocaleDateString(),
    size: fileSize.toFixed(2) + ' MB',
  };
}
