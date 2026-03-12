import * as FileSystem from 'expo-file-system/legacy';
import XLSX from 'xlsx';
import { Product, getAllProducts, Expense, Sale, getAllSales } from './database';
import { Alert } from 'react-native';

/**
 * Export products to Excel format
 */
export async function exportProductsToExcel(products: Product[], businessName: string): Promise<string> {
  try {
    // Prepare data for Excel
    const data = products.map((p) => ({
      'Product Name': p.name,
      'Barcode': p.barcode || '',
      'Selling Price': p.sellingPrice,
      'Cost Price': p.costPrice || 0,
      'Quantity': p.quantity,
      'Category': p.category || '',
      'Unit': p.unit,
      'Reorder Level': p.reorderLevel || 0,
      'Last Updated': new Date(p.updatedAt).toLocaleDateString(),
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');

    // Add metadata sheet
    const metaData = [
      ['Business Name', businessName],
      ['Export Date', new Date().toLocaleString()],
      ['Total Products', products.length],
      ['Total Inventory Value', products.reduce((sum, p) => sum + p.sellingPrice * p.quantity, 0).toFixed(2)],
    ];
    const mws = XLSX.utils.aoa_to_sheet(metaData);
    XLSX.utils.book_append_sheet(wb, mws, 'Metadata');

    // Generate file - save to Downloads folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `products_${businessName.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
    const downloadDir = `${FileSystem.documentDirectory}../Downloads/`;
    
    // Try to create Downloads folder if it doesn't exist
    try {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    } catch (e) {
      // Folder might already exist, continue
    }

    const fileUri = `${downloadDir}${fileName}`;

    // Write file
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });

    return fileUri;
  } catch (error) {
    console.error('Error exporting products to Excel:', error);
    throw new Error('Failed to export products to Excel');
  }
}

/**
 * Export all data to JSON format (for app backup/import)
 */
export async function exportDataToJSON(
  products: Product[],
  sales: Sale[],
  expenses: Expense[],
  businessName: string
): Promise<string> {
  try {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        appVersion: '1.0.0',
        businessName,
        dataCount: {
          products: products.length,
          sales: sales.length,
          expenses: expenses.length,
        },
      },
      data: {
        products,
        sales,
        expenses,
      },
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `backup_${businessName.replace(/\s+/g, '_')}_${timestamp}.json`;
    const downloadDir = `${FileSystem.documentDirectory}../Downloads/`;
    
    // Try to create Downloads folder if it doesn't exist
    try {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    } catch (e) {
      // Folder might already exist, continue
    }

    const fileUri = `${downloadDir}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return fileUri;
  } catch (error) {
    console.error('Error exporting data to JSON:', error);
    throw new Error('Failed to export data to JSON');
  }
}

/**
 * Export inventory to Excel with detailed information
 */
export async function exportInventoryToExcel(products: Product[], businessName: string): Promise<string> {
  try {
    const data = products.map((p) => ({
      'Product ID': p.id,
      'Product Name': p.name,
      'Barcode': p.barcode || 'N/A',
      'Unit': p.unit,
      'Category': p.category || 'N/A',
      'Current Stock': p.quantity,
      'Reorder Level': p.reorderLevel || 0,
      'Selling Price': p.sellingPrice.toFixed(2),
      'Cost Price': (p.costPrice || 0).toFixed(2),
      'Profit Margin': ((p.sellingPrice - (p.costPrice || 0)) / p.sellingPrice * 100).toFixed(2) + '%',
      'Stock Value': (p.sellingPrice * p.quantity).toFixed(2),
      'Status': p.quantity === 0 ? 'Out of Stock' : p.quantity <= (p.reorderLevel || 5) ? 'Low Stock' : 'In Stock',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

    // Add summary sheet
    const totalValue = products.reduce((sum, p) => sum + p.sellingPrice * p.quantity, 0);
    const totalCost = products.reduce((sum, p) => sum + (p.costPrice || 0) * p.quantity, 0);
    const summary = [
      ['Inventory Summary'],
      [],
      ['Total Products', products.length],
      ['Total Quantity', products.reduce((sum, p) => sum + p.quantity, 0)],
      ['Total Inventory Value', totalValue.toFixed(2)],
      ['Total Cost Value', totalCost.toFixed(2)],
      ['Total Profit Potential', (totalValue - totalCost).toFixed(2)],
      ['Low Stock Items', products.filter((p) => p.quantity <= (p.reorderLevel || 5)).length],
      ['Out of Stock Items', products.filter((p) => p.quantity === 0).length],
    ];
    const sws = XLSX.utils.aoa_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, sws, 'Summary');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `inventory_${businessName.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
    const downloadDir = `${FileSystem.documentDirectory}../Downloads/`;
    
    // Try to create Downloads folder if it doesn't exist
    try {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    } catch (e) {
      // Folder might already exist, continue
    }

    const fileUri = `${downloadDir}${fileName}`;

    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });

    return fileUri;
  } catch (error) {
    console.error('Error exporting inventory to Excel:', error);
    throw new Error('Failed to export inventory to Excel');
  }
}

/**
 * Show success message with file location
 */
export async function showExportSuccess(fileUri: string, fileName: string): Promise<void> {
  try {
    const displayName = fileName.split('/').pop() || fileName;
    Alert.alert(
      'Export Successful',
      `File saved to: Downloads/${displayName}\n\nYou can find it in your phone's Downloads folder.`,
      [{ text: 'OK' }]
    );
  } catch (error) {
    console.error('Error showing success message:', error);
  }
}
