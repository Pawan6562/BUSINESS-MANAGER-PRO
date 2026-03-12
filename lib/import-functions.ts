import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import XLSX from 'xlsx';
import { addProduct, addSale, Product, Sale } from './database';
import { Alert } from 'react-native';

/**
 * Import data from JSON file
 */
export async function importFromJSON(): Promise<boolean> {
  try {
    // Pick JSON file
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
    });

    if (result.canceled) {
      return false;
    }

    const fileUri = result.assets[0].uri;

    // Read file content
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Parse JSON
    const backupData = JSON.parse(fileContent);

    // Validate structure
    if (!backupData.data || !backupData.data.products || !Array.isArray(backupData.data.products)) {
      Alert.alert('Invalid File', 'The selected file is not a valid Grocery Manager backup file');
      return false;
    }

    // Ask user if they want to merge or replace
    return new Promise((resolve) => {
      Alert.alert(
        'Import Data',
        'Do you want to merge with existing data or replace it?',
        [
          {
            text: 'Cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Merge',
            onPress: async () => {
              const success = await performJSONImport(backupData, false);
              resolve(success);
            },
          },
          {
            text: 'Replace',
            onPress: async () => {
              const success = await performJSONImport(backupData, true);
              resolve(success);
            },
          },
        ],
        { cancelable: false }
      );
    });
  } catch (error) {
    console.error('Error importing JSON:', error);
    Alert.alert('Error', `Failed to import JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Perform JSON import
 */
async function performJSONImport(backupData: any, replace: boolean): Promise<boolean> {
  try {
    const { products = [], sales = [] } = backupData.data;

    // Import products
    for (const product of products) {
      await addProduct({
        barcode: product.barcode,
        name: product.name,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        quantity: product.quantity,
        reorderLevel: product.reorderLevel,
        unit: product.unit,
        category: product.category,
      });
    }

    // Import sales
    for (const sale of sales) {
      await addSale({
        items: sale.items,
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
      });
    }

    Alert.alert('Success', `Imported ${products.length} products and ${sales.length} sales`);
    return true;
  } catch (error) {
    console.error('Error performing JSON import:', error);
    Alert.alert('Error', `Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Import data from Excel file
 */
export async function importFromExcel(): Promise<boolean> {
  try {
    // Pick Excel file
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    });

    if (result.canceled) {
      return false;
    }

    const fileUri = result.assets[0].uri;

    // Read file as base64
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Parse Excel
    const workbook = XLSX.read(fileContent, { type: 'base64' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!Array.isArray(data) || data.length === 0) {
      Alert.alert('Invalid File', 'The selected Excel file does not contain valid product data');
      return false;
    }

    // Ask user if they want to merge or replace
    return new Promise((resolve) => {
      Alert.alert(
        'Import Products',
        `Found ${data.length} products. Do you want to merge with existing data or replace it?`,
        [
          {
            text: 'Cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Merge',
            onPress: async () => {
              const success = await performExcelImport(data, false);
              resolve(success);
            },
          },
          {
            text: 'Replace',
            onPress: async () => {
              const success = await performExcelImport(data, true);
              resolve(success);
            },
          },
        ],
        { cancelable: false }
      );
    });
  } catch (error) {
    console.error('Error importing Excel:', error);
    Alert.alert('Error', `Failed to import Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Perform Excel import
 */
async function performExcelImport(data: any[], replace: boolean): Promise<boolean> {
  try {
    let importedCount = 0;

    for (const row of data) {
      // Map Excel columns to product fields
      const product = {
        barcode: row['Barcode'] || row['barcode'] || '',
        name: row['Name'] || row['name'] || '',
        costPrice: parseFloat(row['Cost Price'] || row['costPrice'] || '0'),
        sellingPrice: parseFloat(row['Selling Price'] || row['sellingPrice'] || '0'),
        quantity: parseInt(row['Quantity'] || row['quantity'] || '0'),
        reorderLevel: parseInt(row['Reorder Level'] || row['reorderLevel'] || '5'),
        unit: row['Unit'] || row['unit'] || 'pcs',
        category: row['Category'] || row['category'] || '',
      };

      // Validate required fields
      if (!product.name || !product.sellingPrice) {
        continue; // Skip invalid rows
      }

      try {
        await addProduct(product);
        importedCount++;
      } catch (e) {
        // Skip duplicate barcodes or other errors
        console.warn('Skipped row:', product.name, e);
      }
    }

    Alert.alert('Success', `Imported ${importedCount} products from Excel`);
    return true;
  } catch (error) {
    console.error('Error performing Excel import:', error);
    Alert.alert('Error', `Failed to import products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}
