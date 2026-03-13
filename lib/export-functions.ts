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
  const sales = await getAllSales();
  if (products.length === 0) throw new Error('NO_DATA');

  const wb = XLSX.utils.book_new();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

  // CALCULATIONS
  const totalInventoryValue = products.reduce((sum, p) => sum + p.quantity * (p.sellingPrice || 0), 0);
  const totalCostValue = products.reduce((sum, p) => sum + p.quantity * (p.costPrice || 0), 0);
  const totalPotentialProfit = totalInventoryValue - totalCostValue;
  const outOfStock = products.filter(p => p.quantity === 0).length;
  const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= (p.reorderLevel || 5)).length;
  const inStock = products.filter(p => p.quantity > (p.reorderLevel || 5)).length;

  const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalTax = sales.reduce((sum, s) => sum + (s.tax || 0), 0);
  const totalDiscount = sales.reduce((sum, s) => sum + (s.discount || 0), 0);
  const avgSaleValue = sales.length > 0 ? totalRevenue / sales.length : 0;

  // Product sales count
  const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const sale of sales) {
    const items = sale.items || [];
    for (const item of items) {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
      }
      productSalesMap[item.productId].qty += item.quantity;
      productSalesMap[item.productId].revenue += item.subtotal;
    }
  }

  // Payment method breakdown
  const paymentBreakdown: Record<string, number> = {};
  for (const sale of sales) {
    const method = sale.paymentMethod || 'Unknown';
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + sale.total;
  }

  // SHEET 1: BUSINESS SUMMARY
  const summaryData = [
    ['🏪 BUSINESS SUMMARY REPORT', '', '', ''],
    ['Generated:', new Date().toLocaleString(), '', ''],
    ['', '', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', ''],
    ['📦 INVENTORY OVERVIEW', '', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', ''],
    ['Total Products', products.length, '', ''],
    ['In Stock Products', inStock, '', ''],
    ['Low Stock Products', lowStock, '', '⚠️ Reorder karo!'],
    ['Out of Stock Products', outOfStock, '', '❌ Urgent!'],
    ['Total Inventory Value (Selling)', totalInventoryValue.toFixed(2), '', ''],
    ['Total Inventory Cost', totalCostValue.toFixed(2), '', ''],
    ['Potential Profit from Inventory', totalPotentialProfit.toFixed(2), '', ''],
    ['', '', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', ''],
    ['💰 SALES OVERVIEW', '', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', ''],
    ['Total Sales Transactions', sales.length, '', ''],
    ['Total Revenue', totalRevenue.toFixed(2), '', ''],
    ['Total Tax Collected', totalTax.toFixed(2), '', ''],
    ['Total Discounts Given', totalDiscount.toFixed(2), '', ''],
    ['Average Sale Value', avgSaleValue.toFixed(2), '', ''],
    ['', '', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', ''],
    ['💳 PAYMENT METHOD BREAKDOWN', '', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', ''],
    ...Object.entries(paymentBreakdown).map(([method, amount]) => [
      method.toUpperCase(), amount.toFixed(2), `${((amount / totalRevenue) * 100).toFixed(1)}%`, ''
    ]),
    ['', '', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', ''],
    ['💡 BUSINESS HEALTH', '', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '', ''],
    ['Inventory Health', outOfStock === 0 ? '✅ GOOD' : `❌ ${outOfStock} items out of stock`, '', ''],
    ['Stock Alert', lowStock === 0 ? '✅ No low stock items' : `⚠️ ${lowStock} items need reorder`, '', ''],
    ['Sales Activity', sales.length > 0 ? `✅ ${sales.length} sales recorded` : '❌ No sales yet', '', ''],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, '📊 Business Summary');

  // SHEET 2: INVENTORY DETAILS
  const inventoryData = [
    ['📦 INVENTORY REPORT', '', '', '', '', '', '', '', '', '', ''],
    ['Generated:', new Date().toLocaleString(), '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', ''],
    [
      'Product Name', 'Barcode', 'Category', 'Unit',
      'Cost Price', 'Selling Price', 'Profit/Unit', 'Margin %',
      'Qty in Stock', 'Reorder Level', 'Stock Value', 'Stock Status'
    ],
    ...products.map((p) => {
      const profitPerUnit = (p.sellingPrice || 0) - (p.costPrice || 0);
      const marginPct = p.sellingPrice > 0 ? ((profitPerUnit / p.sellingPrice) * 100).toFixed(1) + '%' : '0%';
      const stockValue = p.quantity * (p.sellingPrice || 0);
      const status = p.quantity === 0
        ? '❌ OUT OF STOCK'
        : p.quantity <= (p.reorderLevel || 5)
        ? '⚠️ LOW STOCK'
        : '✅ IN STOCK';
      return [
        p.name, p.barcode || '-', p.category || '-', p.unit || 'pieces',
        (p.costPrice || 0).toFixed(2), (p.sellingPrice || 0).toFixed(2),
        profitPerUnit.toFixed(2), marginPct,
        p.quantity, p.reorderLevel || 5, stockValue.toFixed(2), status
      ];
    }),
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['TOTALS', '', '', '', '', '', '', '', '', '', totalInventoryValue.toFixed(2), ''],
  ];

  const wsInventory = XLSX.utils.aoa_to_sheet(inventoryData);
  wsInventory['!cols'] = [
    { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsInventory, '📦 Inventory');

  // SHEET 3: SALES HISTORY
  const salesRows: any[][] = [];
  salesRows.push(['💰 SALES HISTORY REPORT', '', '', '', '', '', '']);
  salesRows.push(['Generated:', new Date().toLocaleString(), '', '', '', '', '']);
  salesRows.push(['', '', '', '', '', '', '']);
  salesRows.push(['Date & Time', 'Product Name', 'Qty Sold', 'Unit Price', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Method']);

  for (const sale of sales) {
    const items = sale.items || [];
    if (items.length === 0) {
      salesRows.push([
        new Date(sale.createdAt).toLocaleString(), '-', '-', '-',
        sale.subtotal?.toFixed(2), sale.discount?.toFixed(2),
        sale.tax?.toFixed(2), sale.total?.toFixed(2), sale.paymentMethod?.toUpperCase()
      ]);
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (i === 0) {
          salesRows.push([
            new Date(sale.createdAt).toLocaleString(),
            item.productName, item.quantity, item.unitPrice?.toFixed(2), item.subtotal?.toFixed(2),
            sale.discount?.toFixed(2), sale.tax?.toFixed(2), sale.total?.toFixed(2),
            sale.paymentMethod?.toUpperCase()
          ]);
        } else {
          salesRows.push([
            '', item.productName, item.quantity,
            item.unitPrice?.toFixed(2), item.subtotal?.toFixed(2),
            '', '', '', ''
          ]);
        }
      }
    }
  }

  salesRows.push(['', '', '', '', '', '', '']);
  salesRows.push(['TOTAL', '', '', '', '', totalDiscount.toFixed(2), totalTax.toFixed(2), totalRevenue.toFixed(2), '']);

  const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
  wsSales['!cols'] = [
    { wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSales, '💰 Sales History');

  // SHEET 4: PRODUCT PERFORMANCE
  const perfRows = Object.entries(productSalesMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([id, data], index) => {
      const product = products.find(p => p.id === id);
      const costPerUnit = product?.costPrice || 0;
      const profit = data.revenue - data.qty * costPerUnit;
      return [
        index + 1,
        data.name,
        data.qty,
        data.revenue.toFixed(2),
        profit.toFixed(2),
        data.revenue > 0 ? `${((profit / data.revenue) * 100).toFixed(1)}%` : '0%',
        index === 0 ? '🥇 BEST SELLER' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : ''
      ];
    });

  const performanceData = [
    ['📈 PRODUCT PERFORMANCE REPORT', '', '', '', '', '', ''],
    ['Generated:', new Date().toLocaleString(), '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Rank', 'Product Name', 'Units Sold', 'Revenue', 'Profit Earned', 'Profit Margin %', 'Badge'],
    ...perfRows,
    ['', '', '', '', '', '', ''],
    ['', 'TOTAL', '', totalRevenue.toFixed(2), '', '', ''],
  ];

  const wsPerf = XLSX.utils.aoa_to_sheet(performanceData);
  wsPerf['!cols'] = [
    { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsPerf, '📈 Product Performance');

  // SHEET 5: BUSINESS INSIGHTS
  const insightsData: any[][] = [
    ['💡 BUSINESS INSIGHTS & RECOMMENDATIONS', '', ''],
    ['Generated:', new Date().toLocaleString(), ''],
    ['', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', ''],
    ['🚨 URGENT ACTION NEEDED', '', ''],
    ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', ''],
  ];

  const oosProducts = products.filter(p => p.quantity === 0);
  if (oosProducts.length > 0) {
    insightsData.push(['❌ OUT OF STOCK — Restock Immediately:', '', '']);
    oosProducts.forEach(p => insightsData.push([`   • ${p.name}`, 'RESTOCK NOW', '']));
  } else {
    insightsData.push(['✅ No out-of-stock items! Great job.', '', '']);
  }

  insightsData.push(['', '', '']);
  insightsData.push(['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '']);
  insightsData.push(['⚠️ LOW STOCK — Order Soon:', '', '']);
  insightsData.push(['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '']);

  const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= (p.reorderLevel || 5));
  if (lowStockProducts.length > 0) {
    lowStockProducts.forEach(p =>
      insightsData.push([`   • ${p.name}`, `Only ${p.quantity} left`, `Reorder at: ${p.reorderLevel || 5}`])
    );
  } else {
    insightsData.push(['✅ All products have healthy stock levels!', '', '']);
  }

  insightsData.push(['', '', '']);
  insightsData.push(['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '']);
  insightsData.push(['📊 PROFIT MARGIN ANALYSIS', '', '']);
  insightsData.push(['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '']);

  const lowMarginProducts = products.filter(p => {
    const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0;
    return margin < 15;
  });

  if (lowMarginProducts.length > 0) {
    insightsData.push(['⚠️ Low Margin Products (< 15%) — Consider Price Increase:', '', '']);
    lowMarginProducts.forEach(p => {
      const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0;
      insightsData.push([`   • ${p.name}`, `Margin: ${margin.toFixed(1)}%`, `Suggested price: ${(p.costPrice * 1.25).toFixed(2)}`]);
    });
  } else {
    insightsData.push(['✅ All products have healthy margins (15%+)!', '', '']);
  }

  const sortedBySales = Object.entries(productSalesMap).sort((a, b) => b[1].revenue - a[1].revenue);
  insightsData.push(['', '', '']);
  insightsData.push(['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '']);
  insightsData.push(['🏆 SALES PERFORMANCE', '', '']);
  insightsData.push(['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '']);

  if (sortedBySales.length > 0) {
    insightsData.push(['🥇 Best Seller:', sortedBySales[0][1].name, `Revenue: ${sortedBySales[0][1].revenue.toFixed(2)}`]);
    if (sortedBySales.length > 1) {
      const worst = sortedBySales[sortedBySales.length - 1];
      insightsData.push(['📉 Least Sold:', worst[1].name, `Revenue: ${worst[1].revenue.toFixed(2)}`]);
    }
  }

  const neverSold = products.filter(p => !productSalesMap[p.id]);
  if (neverSold.length > 0) {
    insightsData.push(['', '', '']);
    insightsData.push(['❌ Products Never Sold — Consider Promotion/Removal:', '', '']);
    neverSold.forEach(p => insightsData.push([`   • ${p.name}`, `Stock: ${p.quantity}`, `Value locked: ${(p.quantity * p.costPrice).toFixed(2)}`]));
  }

  insightsData.push(['', '', '']);
  insightsData.push(['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '']);
  insightsData.push(['💡 GENERAL TIPS TO BOOST SALES', '', '']);
  insightsData.push(['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', '']);
  insightsData.push(['1.', 'Jo products best sell ho rahe hain unka stock hamesha ready rakho', '']);
  insightsData.push(['2.', 'Low margin products ki price badhao ya cost kam karo', '']);
  insightsData.push(['3.', 'Jo products kabhi nahi biki — promote karo ya bundle offer karo', '']);
  insightsData.push(['4.', 'Low stock items IMMEDIATELY reorder karo — stock out = revenue loss', '']);
  insightsData.push(['5.', 'UPI payments encourage karo — faster aur traceable hota hai', '']);

  const wsInsights = XLSX.utils.aoa_to_sheet(insightsData);
  wsInsights['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsInsights, '💡 Business Insights');

  // WRITE FILE
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const filename = `business-report-${timestamp}.xlsx`;
  const fileUri = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(fileUri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });

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
