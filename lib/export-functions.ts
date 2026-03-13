import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { getAllProducts, getAllSales } from './database';
import { Alert } from 'react-native';

/**
 * Export all data to JSON file and share
 */
export async function exportToJSON(): Promise<boolean> {
  try {
    const products = await getAllProducts();
    const sales = await getAllSales();

    const backupData = {
      metadata: {
        exportDate: new Date().toISOString(),
        appVersion: '1.0.0',
        businessName: 'Grocery Manager Pro',
        dataCount: {
          products: products.length,
          sales: sales.length,
        },
      },
      data: { products, sales },
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `grocery-backup-${timestamp}.json`;

    // ✅ cacheDirectory use karo - hamesha writable hota hai
    const fileUri = FileSystem.cacheDirectory + filename;

    await FileSystem.writeAsStringAsync(fileUri, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save Backup File',
        UTI: 'public.json',
      });
    } else {
      Alert.alert('Error', 'Sharing is not available on this device');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    Alert.alert('Export Failed', `Failed to export JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Export products to Excel file and share
 */
export async function exportToExcel(): Promise<boolean> {
  try {
    const products = await getAllProducts();

    if (products.length === 0) {
      Alert.alert('No Data', 'No products to export');
      return false;
    }

    const wsData = [
      ['Product ID', 'Name', 'Barcode', 'Category', 'Cost Price', 'Selling Price', 'Quantity', 'Stock Status'],
      ...products.map((p) => [
        p.id, p.name, p.barcode || '', p.category || '',
        p.costPrice || 0, p.sellingPrice, p.quantity,
        p.quantity === 0 ? 'Out of Stock' : p.quantity <= 5 ? 'Low Stock' : 'In Stock',
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `grocery-products-${timestamp}.xlsx`;

    // ✅ cacheDirectory use karo
    const fileUri = FileSystem.cacheDirectory + filename;

    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Save Excel File',
        UTI: 'com.microsoft.excel.xlsx',
      });
    } else {
      Alert.alert('Error', 'Sharing is not available on this device');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    Alert.alert('Export Failed', `Failed to export Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Export inventory report to Excel
 */
export async function exportInventoryReport(): Promise<boolean> {
  try {
    const products = await getAllProducts();
    if (products.length === 0) { Alert.alert('No Data', 'No inventory to export'); return false; }

    let totalInventoryValue = 0;
    let totalCost = 0;

    const wsData = [
      ['Inventory Report', '', '', '', '', '', '', ''],
      ['Generated:', new Date().toLocaleString(), '', '', '', '', '', ''],
      [],
      ['Product ID', 'Name', 'Quantity', 'Cost Price', 'Selling Price', 'Profit/Unit', 'Total Value', 'Stock Status'],
      ...products.map((p) => {
        const profitPerUnit = (p.sellingPrice || 0) - (p.costPrice || 0);
        const totalValue = p.quantity * (p.sellingPrice || 0);
        const totalCostValue = p.quantity * (p.costPrice || 0);
        totalInventoryValue += totalValue;
        totalCost += totalCostValue;
        return [p.id, p.name, p.quantity, p.costPrice || 0, p.sellingPrice, profitPerUnit, totalValue,
          p.quantity === 0 ? 'Out of Stock' : p.quantity <= 5 ? 'Low Stock' : 'In Stock'];
      }),
      [], ['SUMMARY', '', '', '', '', '', '', ''],
      ['Total Inventory Value:', totalInventoryValue, '', '', '', '', '', ''],
      ['Total Cost:', totalCost, '', '', '', '', '', ''],
      ['Total Profit Potential:', totalInventoryValue - totalCost, '', '', '', '', '', ''],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileUri = FileSystem.cacheDirectory + `inventory-report-${timestamp}.xlsx`;

    await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Save Inventory Report',
    });
    return true;
  } catch (error) {
    Alert.alert('Export Failed', `Failed to export inventory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Export sales report to Excel
 */
export async function exportSalesReport(): Promise<boolean> {
  try {
    const sales = await getAllSales();
    if (sales.length === 0) { Alert.alert('No Data', 'No sales to export'); return false; }

    let totalRevenue = 0;
    let totalTax = 0;

    const wsData = [
      ['Sales Report', '', '', '', '', ''],
      ['Generated:', new Date().toLocaleString(), '', '', '', ''],
      [],
      ['Sale ID', 'Date', 'Items Count', 'Subtotal', 'Tax', 'Total'],
      ...sales.map((s) => {
        totalRevenue += s.total;
        totalTax += s.tax || 0;
        return [s.id, new Date(s.createdAt).toLocaleString(), s.items?.length || 0,
          (s.total - (s.tax || 0)).toFixed(2), (s.tax || 0).toFixed(2), s.total.toFixed(2)];
      }),
      [], ['SUMMARY', '', '', '', '', ''],
      ['Total Sales:', sales.length, '', '', '', ''],
      ['Total Revenue:', totalRevenue.toFixed(2), '', '', '', ''],
      ['Total Tax:', totalTax.toFixed(2), '', '', '', ''],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileUri = FileSystem.cacheDirectory + `sales-report-${timestamp}.xlsx`;

    await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Save Sales Report',
    });
    return true;
  } catch (error) {
    Alert.alert('Export Failed', `Failed to export sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}
