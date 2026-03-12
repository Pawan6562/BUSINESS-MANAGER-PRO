import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { getAllProducts, getAllSales, Product, Sale, Expense } from './database';
import { Alert } from 'react-native';

/**
 * Export all data to JSON file and download to phone
 */
export async function exportToJSON(): Promise<boolean> {
  try {
    // Fetch all data
    const products = await getAllProducts();
    const sales = await getAllSales();

    // Create backup object
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
      data: {
        products,
        sales,
      },
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(backupData, null, 2);

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `grocery-backup-${timestamp}.json`;

    // Save to downloads directory
    const downloadDir = `${FileSystem.documentDirectory}Downloads/`;
    
    // Create Downloads folder if it doesn't exist
    try {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    } catch (e) {
      // Folder might already exist
    }

    const filePath = `${downloadDir}${filename}`;

    // Write file
    await FileSystem.writeAsStringAsync(filePath, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Export Backup',
        UTI: 'public.json',
      });
    } else {
      Alert.alert('Success', `Backup saved to: ${filePath}`);
    }

    return true;
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    Alert.alert('Error', `Failed to export JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Export products to Excel file and download to phone
 */
export async function exportToExcel(): Promise<boolean> {
  try {
    // Fetch products
    const products = await getAllProducts();

    if (products.length === 0) {
      Alert.alert('No Data', 'No products to export');
      return false;
    }

    // Create worksheet data
    const wsData = [
      ['Product ID', 'Name', 'Barcode', 'Category', 'Cost Price', 'Selling Price', 'Quantity', 'Stock Status'],
      ...products.map((p) => [
        p.id,
        p.name,
        p.barcode || '',
        p.category || '',
        p.costPrice || 0,
        p.sellingPrice,
        p.quantity,
        p.quantity === 0 ? 'Out of Stock' : p.quantity <= 5 ? 'Low Stock' : 'In Stock',
      ]),
    ];

    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');

    // Generate Excel file
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `grocery-products-${timestamp}.xlsx`;

    // Save to downloads directory
    const downloadDir = `${FileSystem.documentDirectory}Downloads/`;
    
    // Create Downloads folder if it doesn't exist
    try {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    } catch (e) {
      // Folder might already exist
    }

    const filePath = `${downloadDir}${filename}`;

    // Write file
    await FileSystem.writeAsStringAsync(filePath, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Products',
        UTI: 'com.microsoft.excel.xlsx',
      });
    } else {
      Alert.alert('Success', `Excel file saved to: ${filePath}`);
    }

    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    Alert.alert('Error', `Failed to export Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Export inventory report to Excel
 */
export async function exportInventoryReport(): Promise<boolean> {
  try {
    const products = await getAllProducts();

    if (products.length === 0) {
      Alert.alert('No Data', 'No inventory to export');
      return false;
    }

    // Calculate totals
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

        return [
          p.id,
          p.name,
          p.quantity,
          p.costPrice || 0,
          p.sellingPrice,
          profitPerUnit,
          totalValue,
          p.quantity === 0 ? 'Out of Stock' : p.quantity <= 5 ? 'Low Stock' : 'In Stock',
        ];
      }),
      [],
      ['SUMMARY', '', '', '', '', '', '', ''],
      ['Total Inventory Value:', totalInventoryValue, '', '', '', '', '', ''],
      ['Total Cost:', totalCost, '', '', '', '', '', ''],
      ['Total Profit Potential:', totalInventoryValue - totalCost, '', '', '', '', '', ''],
    ];

    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

    // Generate Excel file
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `inventory-report-${timestamp}.xlsx`;

    // Save to downloads directory
    const downloadDir = `${FileSystem.documentDirectory}Downloads/`;
    
    try {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    } catch (e) {
      // Folder might already exist
    }

    const filePath = `${downloadDir}${filename}`;

    // Write file
    await FileSystem.writeAsStringAsync(filePath, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Inventory Report',
      });
    } else {
      Alert.alert('Success', `Inventory report saved to: ${filePath}`);
    }

    return true;
  } catch (error) {
    console.error('Error exporting inventory report:', error);
    Alert.alert('Error', `Failed to export inventory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Export sales report to Excel
 */
export async function exportSalesReport(): Promise<boolean> {
  try {
    const sales = await getAllSales();

    if (sales.length === 0) {
      Alert.alert('No Data', 'No sales to export');
      return false;
    }

    // Calculate totals
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

        return [
          s.id,
          new Date(s.createdAt).toLocaleString(),
          s.items?.length || 0,
          (s.total - (s.tax || 0)).toFixed(2),
          (s.tax || 0).toFixed(2),
          s.total.toFixed(2),
        ];
      }),
      [],
      ['SUMMARY', '', '', '', '', ''],
      ['Total Sales:', sales.length, '', '', '', ''],
      ['Total Revenue:', totalRevenue.toFixed(2), '', '', '', ''],
      ['Total Tax:', totalTax.toFixed(2), '', '', '', ''],
    ];

    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');

    // Generate Excel file
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `sales-report-${timestamp}.xlsx`;

    // Save to downloads directory
    const downloadDir = `${FileSystem.documentDirectory}Downloads/`;
    
    try {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    } catch (e) {
      // Folder might already exist
    }

    const filePath = `${downloadDir}${filename}`;

    // Write file
    await FileSystem.writeAsStringAsync(filePath, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Sales Report',
      });
    } else {
      Alert.alert('Success', `Sales report saved to: ${filePath}`);
    }

    return true;
  } catch (error) {
    console.error('Error exporting sales report:', error);
    Alert.alert('Error', `Failed to export sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}
