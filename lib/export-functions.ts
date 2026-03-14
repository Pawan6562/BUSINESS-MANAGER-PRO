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
      businessName: 'Business Manager Pro',
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

  const totalInventoryValue  = products.reduce((s, p) => s + p.quantity * (p.sellingPrice || 0), 0);
  const totalCostValue       = products.reduce((s, p) => s + p.quantity * (p.costPrice || 0), 0);
  const totalPotentialProfit = totalInventoryValue - totalCostValue;
  const outOfStockCount      = products.filter(p => p.quantity === 0).length;
  const lowStockCount        = products.filter(p => p.quantity > 0 && p.quantity <= (p.reorderLevel || 5)).length;
  const inStockCount         = products.filter(p => p.quantity > (p.reorderLevel || 5)).length;
  const totalRevenue         = sales.reduce((s, x) => s + (x.total || 0), 0);
  const totalTax             = sales.reduce((s, x) => s + (x.tax || 0), 0);
  const totalDiscount        = sales.reduce((s, x) => s + (x.discount || 0), 0);
  const avgSaleValue         = sales.length > 0 ? totalRevenue / sales.length : 0;

  const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const sale of sales) {
    for (const item of (sale.items || [])) {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
      }
      productSalesMap[item.productId].qty     += item.quantity;
      productSalesMap[item.productId].revenue += item.subtotal;
    }
  }

  const paymentBreakdown: Record<string, number> = {};
  for (const sale of sales) {
    const method = (sale.paymentMethod || 'Unknown').toUpperCase();
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + sale.total;
  }

  const neverSold = products.filter(p => !productSalesMap[p.id]);

  // SHEET 1
  const sheet1: any[][] = [
    ['BUSINESS SUMMARY REPORT'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['--- INVENTORY OVERVIEW ---'],
    ['Total Products', products.length],
    ['In Stock Products', inStockCount],
    ['Low Stock Products (need reorder)', lowStockCount],
    ['Out of Stock Products', outOfStockCount],
    ['Total Inventory Value (Selling)', Number(totalInventoryValue.toFixed(2))],
    ['Total Inventory Cost', Number(totalCostValue.toFixed(2))],
    ['Potential Profit from Inventory', Number(totalPotentialProfit.toFixed(2))],
    [''],
    ['--- SALES OVERVIEW ---'],
    ['Total Sales Transactions', sales.length],
    ['Total Revenue', Number(totalRevenue.toFixed(2))],
    ['Total Tax Collected', Number(totalTax.toFixed(2))],
    ['Total Discounts Given', Number(totalDiscount.toFixed(2))],
    ['Average Sale Value', Number(avgSaleValue.toFixed(2))],
    [''],
    ['--- PAYMENT METHOD BREAKDOWN ---'],
    ['Payment Method', 'Amount', 'Share %'],
    ...Object.entries(paymentBreakdown).map(([method, amount]) => [
      method,
      Number(amount.toFixed(2)),
      totalRevenue > 0 ? Number(((amount / totalRevenue) * 100).toFixed(1)) : 0,
    ]),
    [''],
    ['--- BUSINESS HEALTH ---'],
    ['Inventory Health', outOfStockCount === 0 ? 'GOOD - No out-of-stock items' : 'WARNING - ' + outOfStockCount + ' items out of stock'],
    ['Stock Alert', lowStockCount === 0 ? 'OK - No low stock items' : 'ALERT - ' + lowStockCount + ' items need reorder'],
    ['Sales Activity', sales.length > 0 ? 'Active - ' + sales.length + ' sales recorded' : 'No sales recorded yet'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
  ws1['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Business Summary');

  // SHEET 2
  const sheet2: any[][] = [
    ['INVENTORY REPORT'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['Product Name', 'Barcode', 'Category', 'Unit', 'Cost Price', 'Selling Price', 'Profit Per Unit', 'Margin %', 'Qty in Stock', 'Reorder Level', 'Stock Value', 'Stock Status'],
  ];
  for (const p of products) {
    const profitPerUnit = (p.sellingPrice || 0) - (p.costPrice || 0);
    const marginPct     = p.sellingPrice > 0 ? Number(((profitPerUnit / p.sellingPrice) * 100).toFixed(1)) : 0;
    const stockValue    = p.quantity * (p.sellingPrice || 0);
    const status        = p.quantity === 0 ? 'OUT OF STOCK' : p.quantity <= (p.reorderLevel || 5) ? 'LOW STOCK' : 'IN STOCK';
    sheet2.push([
      p.name, p.barcode || '-', p.category || '-', p.unit || 'pieces',
      Number((p.costPrice || 0).toFixed(2)), Number((p.sellingPrice || 0).toFixed(2)),
      Number(profitPerUnit.toFixed(2)), marginPct,
      p.quantity, p.reorderLevel || 5, Number(stockValue.toFixed(2)), status,
    ]);
  }
  sheet2.push(['']);
  sheet2.push(['TOTALS', '', '', '', '', '', '', '', '', '', Number(totalInventoryValue.toFixed(2)), '']);
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2);
  ws2['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Inventory');

  // SHEET 3
  const sheet3: any[][] = [
    ['SALES HISTORY REPORT'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['Date & Time', 'Product Name', 'Qty Sold', 'Unit Price', 'Item Subtotal', 'Discount', 'Tax', 'Sale Total', 'Payment'],
  ];
  for (const sale of sales) {
    const items = sale.items || [];
    if (items.length === 0) {
      sheet3.push([
        new Date(sale.createdAt).toLocaleString(), '-', 0, 0,
        Number((sale.subtotal || 0).toFixed(2)), Number((sale.discount || 0).toFixed(2)),
        Number((sale.tax || 0).toFixed(2)), Number((sale.total || 0).toFixed(2)),
        (sale.paymentMethod || 'cash').toUpperCase(),
      ]);
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (i === 0) {
          sheet3.push([
            new Date(sale.createdAt).toLocaleString(), item.productName, item.quantity,
            Number((item.unitPrice || 0).toFixed(2)), Number((item.subtotal || 0).toFixed(2)),
            Number((sale.discount || 0).toFixed(2)), Number((sale.tax || 0).toFixed(2)),
            Number((sale.total || 0).toFixed(2)), (sale.paymentMethod || 'cash').toUpperCase(),
          ]);
        } else {
          sheet3.push(['', item.productName, item.quantity, Number((item.unitPrice || 0).toFixed(2)), Number((item.subtotal || 0).toFixed(2)), '', '', '', '']);
        }
      }
    }
  }
  sheet3.push(['']);
  sheet3.push(['TOTALS', '', '', '', '', Number(totalDiscount.toFixed(2)), Number(totalTax.toFixed(2)), Number(totalRevenue.toFixed(2)), '']);
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3);
  ws3['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Sales History');

  // SHEET 4
  const sheet4: any[][] = [
    ['PRODUCT PERFORMANCE REPORT'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['Rank', 'Product Name', 'Units Sold', 'Revenue', 'Profit Earned', 'Profit Margin %', 'Badge'],
  ];
  const sortedBySales = Object.entries(productSalesMap).sort((a, b) => b[1].revenue - a[1].revenue);
  sortedBySales.forEach(([id, data], index) => {
    const product     = products.find(p => p.id === id);
    const costPerUnit = product?.costPrice || 0;
    const profit      = data.revenue - data.qty * costPerUnit;
    const marginPct   = data.revenue > 0 ? Number(((profit / data.revenue) * 100).toFixed(1)) : 0;
    const badge       = index === 0 ? 'BEST SELLER' : index === 1 ? '2nd' : index === 2 ? '3rd' : '';
    sheet4.push([index + 1, data.name, data.qty, Number(data.revenue.toFixed(2)), Number(profit.toFixed(2)), marginPct, badge]);
  });
  if (neverSold.length > 0) {
    sheet4.push(['']);
    sheet4.push(['--- PRODUCTS WITH NO SALES ---']);
    for (const p of neverSold) {
      sheet4.push(['-', p.name, 0, 0, 0, 0, 'NO SALES YET']);
    }
  }
  sheet4.push(['']);
  sheet4.push(['', 'TOTAL', '', Number(totalRevenue.toFixed(2)), '', '', '']);
  const ws4 = XLSX.utils.aoa_to_sheet(sheet4);
  ws4['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Product Performance');

  // SHEET 5
  const sheet5: any[][] = [
    ['BUSINESS INSIGHTS AND RECOMMENDATIONS'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['--- URGENT: OUT OF STOCK ITEMS ---'],
  ];
  const oosProducts = products.filter(p => p.quantity === 0);
  if (oosProducts.length > 0) {
    sheet5.push(['Product Name', 'Action', 'Cost Price', 'Selling Price']);
    for (const p of oosProducts) { sheet5.push([p.name, 'RESTOCK IMMEDIATELY', p.costPrice, p.sellingPrice]); }
  } else {
    sheet5.push(['No out-of-stock items. Great job!']);
  }
  sheet5.push(['']);
  sheet5.push(['--- LOW STOCK ITEMS (Order Soon) ---']);
  const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= (p.reorderLevel || 5));
  if (lowStockProducts.length > 0) {
    sheet5.push(['Product Name', 'Current Qty', 'Reorder Level', 'Suggested Order']);
    for (const p of lowStockProducts) {
      sheet5.push([p.name, p.quantity, p.reorderLevel || 5, Math.max((p.reorderLevel || 5) * 3 - p.quantity, 10)]);
    }
  } else {
    sheet5.push(['All products have healthy stock levels!']);
  }
  sheet5.push(['']);
  sheet5.push(['--- LOW PROFIT MARGIN PRODUCTS (Consider Price Increase) ---']);
  const lowMarginProducts = products.filter(p => {
    const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0;
    return margin < 15;
  });
  if (lowMarginProducts.length > 0) {
    sheet5.push(['Product Name', 'Current Margin %', 'Current Price', 'Suggested New Price']);
    for (const p of lowMarginProducts) {
      const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0;
      sheet5.push([p.name, Number(margin.toFixed(1)), p.sellingPrice, Number((p.costPrice * 1.25).toFixed(2))]);
    }
  } else {
    sheet5.push(['All products have healthy margins above 15%!']);
  }
  sheet5.push(['']);
  sheet5.push(['--- PRODUCTS NEVER SOLD (Investigate / Promote) ---']);
  if (neverSold.length > 0) {
    sheet5.push(['Product Name', 'Stock Qty', 'Cost Locked', 'Recommendation']);
    for (const p of neverSold) { sheet5.push([p.name, p.quantity, Number((p.quantity * p.costPrice).toFixed(2)), 'Offer discount or bundle deal']); }
  } else {
    sheet5.push(['All products have been sold at least once!']);
  }
  if (sortedBySales.length > 0) {
    sheet5.push(['']);
    sheet5.push(['--- SALES PERFORMANCE HIGHLIGHTS ---']);
    sheet5.push(['Best Seller', sortedBySales[0][1].name, 'Revenue: ' + sortedBySales[0][1].revenue.toFixed(2)]);
    if (sortedBySales.length > 1) {
      const worst = sortedBySales[sortedBySales.length - 1];
      sheet5.push(['Least Sold', worst[1].name, 'Revenue: ' + worst[1].revenue.toFixed(2)]);
    }
  }
  sheet5.push(['']);
  sheet5.push(['--- GENERAL TIPS TO BOOST YOUR BUSINESS ---']);
  sheet5.push(['Tip 1', 'Keep best-selling products always in stock. Stock out = lost revenue.']);
  sheet5.push(['Tip 2', 'Low margin products: increase price or negotiate lower cost with supplier.']);
  sheet5.push(['Tip 3', 'Never-sold products: run a bundle offer or discount to clear stock.']);
  sheet5.push(['Tip 4', 'Reorder low-stock items BEFORE they run out, not after.']);
  sheet5.push(['Tip 5', 'Encourage UPI payments. Faster and fully trackable.']);
  sheet5.push(['Tip 6', 'Review sales every week to spot which products are trending up or down.']);
  const ws5 = XLSX.utils.aoa_to_sheet(sheet5);
  ws5['!cols'] = [{ wch: 42 }, { wch: 28 }, { wch: 24 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Business Insights');

  const wbout   = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const filename = 'business-report-' + timestamp + '.xlsx';
  const fileUri  = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
  return { fileUri, filename };
}

export async function exportToJSONShare(): Promise<boolean> {
  try {
    const { fileUri } = await buildJSONFile();
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Share JSON Backup', UTI: 'public.json' });
    return true;
  } catch (error) {
    Alert.alert('Share Failed', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export async function exportToJSONDownload(): Promise<boolean> {
  try {
    const { fileUri, filename } = await buildJSONFile();
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) { Alert.alert('Permission Denied', 'Storage permission required'); return false; }
    const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, filename, 'application/json');
    await FileSystem.writeAsStringAsync(destUri, content, { encoding: FileSystem.EncodingType.UTF8 });
    Alert.alert('Downloaded!', '"' + filename + '" save ho gaya!');
    return true;
  } catch (error) {
    Alert.alert('Download Failed', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export async function exportToExcelShare(): Promise<boolean> {
  try {
    const { fileUri } = await buildExcelFile();
    await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Share Business Report', UTI: 'com.microsoft.excel.xlsx' });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_DATA') { Alert.alert('No Data', 'No products to export'); }
    else { Alert.alert('Share Failed', error instanceof Error ? error.message : 'Unknown error'); }
    return false;
  }
}

export async function exportToExcelDownload(): Promise<boolean> {
  try {
    const { fileUri, filename } = await buildExcelFile();
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) { Alert.alert('Permission Denied', 'Storage permission required'); return false; }
    const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await FileSystem.writeAsStringAsync(destUri, content, { encoding: FileSystem.EncodingType.Base64 });
    Alert.alert('Downloaded!', '"' + filename + '" save ho gaya!');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_DATA') { Alert.alert('No Data', 'No products to export'); }
    else { Alert.alert('Download Failed', error instanceof Error ? error.message : 'Unknown error'); }
    return false;
  }
}

export async function exportToJSON():  Promise<boolean> { return exportToJSONShare();  }
export async function exportToExcel(): Promise<boolean> { return exportToExcelShare(); }

export async function exportInventoryReport(): Promise<boolean> {
  try {
    const products = await getAllProducts();
    if (products.length === 0) { Alert.alert('No Data', 'No inventory to export'); return false; }
    let totalInventoryValue = 0, totalCost = 0;
    const wsData: any[][] = [
      ['Inventory Report'], ['Generated', new Date().toLocaleString()], [''],
      ['Product Name', 'Qty', 'Cost Price', 'Selling Price', 'Profit/Unit', 'Total Value', 'Status'],
    ];
    for (const p of products) {
      const profitPerUnit = (p.sellingPrice || 0) - (p.costPrice || 0);
      const totalValue    = p.quantity * (p.sellingPrice || 0);
      totalInventoryValue += totalValue;
      totalCost           += p.quantity * (p.costPrice || 0);
      wsData.push([p.name, p.quantity, Number((p.costPrice || 0).toFixed(2)), Number((p.sellingPrice || 0).toFixed(2)), Number(profitPerUnit.toFixed(2)), Number(totalValue.toFixed(2)), p.quantity === 0 ? 'OUT OF STOCK' : p.quantity <= 5 ? 'LOW STOCK' : 'IN STOCK']);
    }
    wsData.push([''], ['Total Inventory Value', '', '', '', '', Number(totalInventoryValue.toFixed(2)), '']);
    wsData.push(['Total Cost', '', '', '', '', Number(totalCost.toFixed(2)), '']);
    wsData.push(['Potential Profit', '', '', '', '', Number((totalInventoryValue - totalCost).toFixed(2)), '']);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    const wbout   = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileUri = FileSystem.cacheDirectory + 'inventory-report-' + timestamp + '.xlsx';
    await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Save Inventory Report' });
    return true;
  } catch (error) {
    Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export async function exportSalesReport(): Promise<boolean> {
  try {
    const sales = await getAllSales();
    if (sales.length === 0) { Alert.alert('No Data', 'No sales to export'); return false; }
    let totalRevenue = 0, totalTax = 0;
    const wsData: any[][] = [
      ['Sales Report'], ['Generated', new Date().toLocaleString()], [''],
      ['Date', 'Items Count', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment'],
    ];
    for (const s of sales) {
      totalRevenue += s.total; totalTax += s.tax || 0;
      wsData.push([new Date(s.createdAt).toLocaleString(), s.items?.length || 0, Number(((s.total || 0) - (s.tax || 0)).toFixed(2)), Number((s.tax || 0).toFixed(2)), Number((s.discount || 0).toFixed(2)), Number((s.total || 0).toFixed(2)), (s.paymentMethod || 'cash').toUpperCase()]);
    }
    wsData.push([''], ['Total Sales', sales.length, '', '', '', '', '']);
    wsData.push(['Total Revenue', '', '', '', '', Number(totalRevenue.toFixed(2)), '']);
    wsData.push(['Total Tax', '', '', '', '', Number(totalTax.toFixed(2)), '']);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    const wbout    = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileUri  = FileSystem.cacheDirectory + 'sales-report-' + timestamp + '.xlsx';
    await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Save Sales Report' });
    return true;
  } catch (error) {
    Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}
