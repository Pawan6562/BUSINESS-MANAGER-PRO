import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Product, Sale, Expense, addProduct, addSale, addExpense, getAllProducts } from './database';

export interface BackupData {
  version: string;
  exportDate: string;
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
}

export const pickAndImportFile = async (): Promise<BackupData | null> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return null;
    }

    const file = result.assets[0];
    if (!file.uri) {
      throw new Error('No file URI available');
    }

    // Read file content
    const fileContent = await FileSystem.readAsStringAsync(file.uri);
    const data: BackupData = JSON.parse(fileContent);

    // Validate backup data structure
    if (!data.version || !Array.isArray(data.products) || !Array.isArray(data.sales) || !Array.isArray(data.expenses)) {
      throw new Error('Invalid backup file format');
    }

    return data;
  } catch (error) {
    console.error('Error picking or parsing file:', error);
    throw error;
  }
};

export const importBackupData = async (
  data: BackupData,
  mergeMode: 'replace' | 'merge' = 'merge'
): Promise<{ success: boolean; message: string; imported: { products: number; sales: number; expenses: number } }> => {
  try {
    let importedCount = { products: 0, sales: 0, expenses: 0 };

    // Import products
    if (data.products && Array.isArray(data.products)) {
      for (const product of data.products) {
        try {
          if (mergeMode === 'merge') {
            // Check if product exists
            const existing = await getAllProducts();
            const exists = existing.some((p) => p.id === product.id || p.barcode === product.barcode);
            if (!exists) {
              await addProduct(product);
              importedCount.products++;
            }
          } else {
            // Replace mode - just add
            await addProduct(product);
            importedCount.products++;
          }
        } catch (e) {
          console.warn('Failed to import product:', product.name, e);
        }
      }
    }

    // Import sales
    if (data.sales && Array.isArray(data.sales)) {
      for (const sale of data.sales) {
        try {
          await addSale(sale);
          importedCount.sales++;
        } catch (e) {
          console.warn('Failed to import sale:', e);
        }
      }
    }

    // Import expenses
    if (data.expenses && Array.isArray(data.expenses)) {
      for (const expense of data.expenses) {
        try {
          await addExpense(expense);
          importedCount.expenses++;
        } catch (e) {
          console.warn('Failed to import expense:', e);
        }
      }
    }

    return {
      success: true,
      message: `Successfully imported ${importedCount.products} products, ${importedCount.sales} sales, and ${importedCount.expenses} expenses`,
      imported: importedCount,
    };
  } catch (error) {
    console.error('Error importing backup data:', error);
    throw error;
  }
};

export const validateBackupFile = (data: any): boolean => {
  try {
    if (!data.version || typeof data.version !== 'string') return false;
    if (!data.exportDate || typeof data.exportDate !== 'string') return false;
    if (!Array.isArray(data.products)) return false;
    if (!Array.isArray(data.sales)) return false;
    if (!Array.isArray(data.expenses)) return false;

    // Validate product structure
    for (const product of data.products) {
      if (!product.id || !product.name || typeof product.quantity !== 'number') {
        return false;
      }
    }

    // Validate sale structure
    for (const sale of data.sales) {
      if (!sale.id || !Array.isArray(sale.items) || typeof sale.total !== 'number') {
        return false;
      }
    }

    // Validate expense structure
    for (const expense of data.expenses) {
      if (!expense.id || !expense.category || typeof expense.amount !== 'number') {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating backup file:', error);
    return false;
  }
};

export const getBackupFileInfo = (data: BackupData): { productCount: number; saleCount: number; expenseCount: number; exportDate: string } => {
  return {
    productCount: data.products?.length || 0,
    saleCount: data.sales?.length || 0,
    expenseCount: data.expenses?.length || 0,
    exportDate: data.exportDate || 'Unknown',
  };
};
