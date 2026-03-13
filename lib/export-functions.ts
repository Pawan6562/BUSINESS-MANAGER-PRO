import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { getAllProducts, getAllSales } from './database';
import { Alert } from 'react-native';

async function buildJSONFile(): Promise<{ fileUri: string; filename: string }> {
  const products = await getAllProducts();
  const sales = await getAllSales();
  const backupData = {
    metadata: {
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0',
      businessName: 'Grocery Manager Pro',
      dataCount: { products: products.length, sales: sales.length },
    },
    data: { products, sales },
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `grocery-backup-${timestamp}.json`;
  const fileUri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return { fileUri, filename };
}

async function buildExcelFile(): Promise<{ fileUri: string; filename: string }> {
  const products = await getAllProducts();
  if (products.length === 0) throw new Error('NO_DATA');
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
  const fileUri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
  return { fileUri, filename };
}

export async function exportToJSONShare(): Promise<boolean> {
  try {
    const { fileUri } = await buildJSONFile();
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Share JSON Backup', UTI: 'public.json' });
    return true;
  } catch (error) {
    Alert.alert('Share Failed', `${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

export async function exportToJSONDownload(): Promise<boolean> {
  try {
    const { fileUri, filename } = await buildJSONFile();
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      Alert.alert('Permission Denied', 'Storage permission is required to save file');
      return false;
    }
    const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, filename, 'application/json');
    await FileSystem.writeAsStringAsync(destUri, content, { encoding: FileSystem.EncodingType.UTF8 });
    Alert.alert('✅ Downloaded!', `"${filename}" save ho gaya chosen folder mein!`);
    return true;
  } catch (error) {
    Alert.alert('Download Failed', `${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

export async function exportToExcelShare(): Promise<boolean> {
  try {
    const { fileUri } = await buildExcelFile();
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Share Excel File',
      UTI: 'com.microsoft.excel.xlsx',
    });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_DATA') {
      Alert.alert('No Data', 'No products to export');
    } else {
      Alert.alert('Share Failed', `${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return false;
  }
}

export async function exportToExcelDownload(): Promise<boolean> {
  try {
    const { fileUri, filename } = await buildExcelFile();
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      Alert.alert('Permission Denied', 'Storage permission is required to save file');
      return false;
    }
    const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri, filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    await FileSystem.writeAsStringAsync(destUri, content, { encoding: FileSystem.EncodingType.Base64 });
    Alert.alert('✅ Downloaded!', `"${filename}" save ho gaya chosen folder mein!`);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_DATA') {
      Alert.alert('No Data', 'No products to export');
    } else {
      Alert.alert('Download Failed', `${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return false;
  }
}

// Backward compatibility
export async function exportToJSON(): Promise<boolean> { return exportToJSONShare(); }
export async function exportToExcel(): Promise<boolean> { return exportToExcelShare(); }

export async function exportInventoryReport(): Promise<boolean> {
  try {
    const products = await getAllProducts();
    if (products.length === 0) { Alert.alert('No Data', 'No inventory to export'); return false; }
    let totalInventoryValue = 0, totalCost = 0;
    const wsData = [
      ['Inventory Report', '', '', '', '', '', '', ''],
      ['Generated:', new Date().toLocaleString(), '', '', '', '', '', ''],
      [],
      ['Product ID', 'Name', 'Quantity', 'Cost Price', 'Selling Price', 'Profit/Unit', 'Total Value', 'Stock Status'],
      ...products.map((p) => {
        const profitPerUnit = (p.sellingPrice || 0) - (p.costPrice || 0);
        const totalValue = p.quantity * (p.sellingPrice || 0);
        totalInventoryValue += totalValue;
        totalCost += p.quantity * (p.costPrice || 0);
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
    Alert.alert('Export Failed', `${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

export async function exportSalesReport(): Promise<boolean> {
  try {
    const sales = await getAllSales();
    if (sales.length === 0) { Alert.alert('No Data', 'No sales to export'); return false; }
    let totalRevenue = 0, totalTax = 0;
    const wsData = [
      ['Sales Report', '', '', '', '', ''],
      ['Generated:', new Date().toLocaleString(), '', '', '', ''],
      [],
      ['Sale ID', 'Date', 'Items Count', 'Subtotal', 'Tax', 'Total'],
      ...sales.map((s) => {
        totalRevenue += s.total; totalTax += s.tax || 0;
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
    Alert.alert('Export Failed', `${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}
