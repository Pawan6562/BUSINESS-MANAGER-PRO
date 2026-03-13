import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { getAllProducts, getAllSales } from './database';
import { Alert } from 'react-native';

// ─── HELPER: Build JSON file in cache ────────────────────────────────────────
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

// ─── HELPER: Build Excel file in cache ───────────────────────────────────────
async function buildExcelFile(): Promise<{ fileUri: string; filename: string }> {
  const products = await getAllProducts();
  const sales = await getAllSales();

  if (products.length === 0) throw new Error('NO_DATA');

  const wb = XLSX.utils.book_new();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

  // ─── CALCULATIONS ─────────────────────────────────────────────────────────
  const totalInventoryValue  = products.reduce((s, p) => s + p.quantity * (p.sellingPrice || 0), 0);
  const totalCostValue       = products.reduce((s, p) => s + p.quantity * (p.costPrice || 0), 0);
  const totalPotentialProfit = totalInventoryValue - totalCostValue;
  const outOfStockCount      = products.filter(p => p.quantity === 0).length;
  const lowStockCount        = products.filter(p => p.quantity > 0 && p.quantity <= (p.reorderLevel || 5)).length;
  const inStockCount         = products.filter(p => p.quantity > (p.reorderLevel || 5)).length;

  const totalRevenue  = sales.reduce((s, x) => s + (x.total || 0), 0);
  const totalTax      = sales.reduce((s, x) => s + (x.tax || 0), 0);
  const totalDiscount = sales.reduce((s, x) => s + (x.discount || 0), 0);
  const avgSaleValue  = sales.length > 0 ? totalRevenue / sales.length : 0;

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

  // ─── SHEET 1: BUSINESS SUMMARY ────────────────────────────────────────────
  const sheet1: any[][] = [
    ['BUSINESS SUMMARY REPORT'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['--- INVENTORY OVERVIEW ---'],
    ['Total Products',                    products.length],
    ['In Stock Products',                 inStockCount],
    ['Low Stock Products (need reorder)', lowStockCount],
    ['Out of Stock Products',             outOfStockCount],
    ['Total Inventory Value (Selling)',   Number(totalInventoryValue.toFixed(2))],
    ['Total Inventory Cost',              Number(totalCostValue.toFixed(2))],
    ['Potential Profit from Inventory',   Number(totalPotentialProfit.toFixed(2))],
    [''],
    ['--- SALES OVERVIEW ---'],
    ['Total Sales Transactions', sales.length],
    ['Total Revenue',            Number(totalRevenue.toFixed(2))],
    ['Total Tax Collected',      Number(totalTax.toFixed(2))],
    ['Total Discounts Given',    Number(totalDiscount.toFixed(2))],
    ['Average Sale Value',       Number(avgSaleValue.toFixed(2))],
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
    ['Inventory Health',
      outOfStockCount === 0 ? 'GOOD - No out-of-stock items' : 'WARNING - ' + outOfStockCount + ' items out of stock'],
    ['Stock Alert',
      lowStockCount === 0 ? 'OK - No low stock items' : 'ALERT - ' + lowStockCount + ' items need reorder'],
    ['Sales Activity',
      sales.length > 0 ? 'Active - ' + sales.length + ' sales recorded' : 'No sales recorded yet'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
  ws1['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Business Summary');

  // ─── SHEET 2: INVENTORY ───────────────────────────────────────────────────
  const sheet2: any[][] = [
    ['INVENTORY REPORT'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['Product Name', 'Barcode', 'Category', 'Unit',
     'Cost Price', 'Selling Price', 'Profit Per Unit', 'Margin %',
     'Qty in Stock', 'Reorder Level', 'Stock Value', 'Stock Status'],
  ];
  for (const p of products) {
    const profitPerUnit = (p.sellingPrice || 0) - (p.costPrice || 0);
    const marginPct     = p.sellingPrice > 0 ? Number(((profitPerUnit / p.sellingPrice) * 100).toFixed(1)) : 0;
    const stockValue    = p.quantity * (p.sellingPrice || 0);
    const status        = p.quantity === 0 ? 'OUT OF STOCK'
                        : p.quantity <= (p.reorderLevel || 5) ? 'LOW STOCK'
                        : 'IN STOCK';
    sheet2.push([
      p.name, p.barcode || '-', p.category || '-', p.unit || 'pieces',
      Number((p.costPrice || 0).toFixed(2)), Number((p.sellingPrice || 0).toFixed(2)),
      Number(profitPerUnit.toFixed(2)), marginPct,
      p.quantity, p.reorderLevel || 5,
      Number(stockValue.toFixed(2)), status,
    ]);
  }
  sheet2.push(['']);
  sheet2.push(['TOTALS', '', '', '', '', '', '', '', '', '', Number(totalInventoryValue.toFixed(2)), '']);
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2);
  ws2['!cols'] = [
    { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 10 },
    { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Inventory');

  // ─── SHEET 3: SALES HISTORY ────────────────────────────────────────────────
  const sheet3: any[][] = [
    ['SALES HISTORY REPORT'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['Date & Time', 'Product Name', 'Qty Sold', 'Unit Price',
     'Item Subtotal', 'Discount', 'Tax', 'Sale Total', 'Payment'],
  ];
  for (const sale of sales) {
    const items = sale.items || [];
    if (items.length === 0) {
      sheet3.push([
        new Date(sale.createdAt).toLocaleString(), '-', 0, 0,
        Number((sale.subtotal || 0).toFixed(2)),
        Number((sale.discount || 0).toFixed(2)),
        Number((sale.tax || 0).toFixed(2)),
        Number((sale.total || 0).toFixed(2)),
        (sale.paymentMethod || 'cash').toUpperCase(),
      ]);
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (i === 0) {
          sheet3.push([
            new Date(sale.createdAt).toLocaleString(),
            item.productName, item.quantity,
            Number((item.unitPrice || 0).toFixed(2)),
            Number((item.subtotal || 0).toFixed(2)),
            Number((sale.discount || 0).toFixed(2)),
            Number((sale.tax || 0).toFixed(2)),
            Number((sale.total || 0).toFixed(2)),
            (sale.paymentMethod || 'cash').toUpperCase(),
          ]);
        } else {
          sheet3.push([
            '', item.productName, item.quantity,
            Number((item.unitPrice || 0).toFixed(2)),
            Number((item.subtotal || 0).toFixed(2)),
            '', '', '', '',
          ]);
        }
      }
    }
  }
  sheet3.push(['']);
  sheet3.push([
    'TOTALS', '', '', '', '',
    Number(totalDiscount.toFixed(2)),
    Number(totalTax.toFixed(2)),
    Number(totalRevenue.toFixed(2)), '',
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3);
  ws3['!cols'] = [
    { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'Sales History');

  // ─── SHEET 4: PRODUCT PERFORMANCE ─────────────────────────────────────────
  const sheet4: any[][] = [
    ['PRODUCT PERFORMANCE REPORT'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['Rank', 'Product Name', 'Units Sold', 'Revenue', 'Profit Earned', 'Profit Margin %', 'Badge'],
  ];
  const sortedBySales = Object.entries(productSalesMap)
    .sort((a, b) => b[1].revenue - a[1].revenue);
  sortedBySales.forEach(([id, data], index) => {
    const product     = products.find(p => p.id === id);
    const costPerUnit = product?.costPrice || 0;
    const profit      = data.revenue - data.qty * costPerUnit;
    const marginPct   = data.revenue > 0 ? Number(((profit / data.revenue) * 100).toFixed(1)) : 0;
    const badge       = index === 0 ? 'BEST SELLER' : index === 1 ? '2nd' : index === 2 ? '3rd' : '';
    sheet4.push([
      index + 1, data.name, data.qty,
      Number(data.revenue.toFixed(2)),
      Number(profit.toFixed(2)),
      marginPct, badge,
    ]);
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
  ws4['!cols'] = [
    { wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws4, 'Product Performance');

  // ─── SHEET 5: BUSINESS INSIGHTS ───────────────────────────────────────────
  const sheet5: any[][] = [
    ['BUSINESS INSIGHTS AND RECOMMENDATIONS'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['--- URGENT ACTION NEEDED ---'],
  ];

  const oosProducts = products.filter(p => p.quantity === 0);
  if (oosProducts.length > 0) {
    sheet5.push(['OUT OF STOCK - Restock Immediately:']);
    oosProducts.forEach(p => sheet5.push(['   ' + p.name, 'RESTOCK NOW', '']));
  } else {
    sheet5.push(['No out-of-stock items! Great job.']);
  }

  sheet5.push(['']);
  sheet5.push(['--- LOW STOCK - Order Soon ---']);
  const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= (p.reorderLevel || 5));
  if (lowStockProducts.length > 0) {
    lowStockProducts.forEach(p =>
      sheet5.push(['   ' + p.name, 'Only ' + p.quantity + ' left', 'Reorder at: ' + (p.reorderLevel || 5)])
    );
  } else {
    sheet5.push(['All products have healthy stock levels!']);
  }

  sheet5.push(['']);
  sheet5.push(['--- PROFIT MARGIN ANALYSIS ---']);
  const lowMarginProducts = products.filter(p => {
    const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0;
    return margin < 15;
  });

  if (lowMarginProducts.length > 0) {
    sheet5.push(['Low Margin Products (< 15%) - Consider Price Increase:']);
    lowMarginProducts.forEach(p => {
      const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0;
      sheet5.push(['   ' + p.name, 'Margin: ' + margin.toFixed(1) + '%', 'Suggested price: ' + (p.costPrice * 1.25).toFixed(2)]);
    });
  } else {
    sheet5.push(['All products have healthy margins (15%+)!']);
  }

  sheet5.push(['']);
  sheet5.push(['--- SALES PERFORMANCE ---']);
  if (sortedBySales.length > 0) {
    sheet5.push(['Best Seller:', sortedBySales[0][1].name, 'Revenue: ' + sortedBySales[0][1].revenue.toFixed(2)]);
    if (sortedBySales.length > 1) {
      const worst = sortedBySales[sortedBySales.length - 1];
      sheet5.push(['Least Sold:', worst[1].name, 'Revenue: ' + worst[1].revenue.toFixed(2)]);
    }
  }

  if (neverSold.length > 0) {
    sheet5.push(['']);
    sheet5.push(['Products Never Sold - Consider Promotion/Removal:']);
    neverSold.forEach(p => sheet5.push(['   ' + p.name, 'Stock: ' + p.quantity, 'Value locked: ' + (p.quantity * p.costPrice).toFixed(2)]));
  }

  sheet5.push(['']);
  sheet5.push(['--- GENERAL TIPS TO BOOST SALES ---']);
  sheet5.push(['1.', 'Keep best-selling products always in stock']);
  sheet5.push(['2.', 'Increase price or reduce cost for low-margin products']);
  sheet5.push(['3.', 'Promote or bundle products that never sell']);
  sheet5.push(['4.', 'Reorder low-stock items immediately to avoid revenue loss']);
  sheet5.push(['5.', 'Encourage UPI payments - faster and traceable']);

  const ws5 = XLSX.utils.aoa_to_sheet(sheet5);
  ws5['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Business Insights');

  // ─── WRITE FILE ───────────────────────────────────────────────────────────
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const filename = `business-report-${timestamp}.xlsx`;
  const fileUri = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(fileUri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { fileUri, filename };
}

// ─── EXPORT: JSON Share ────────────────────────────────────────────────────────
export async function exportToJSONShare(): Promise<boolean> {
  try {
    const { fileUri, filename } = await buildJSONFile();
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Error', 'Sharing is not available on this device');
      return false;
    }
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', UTI: 'com.apple.json' });
    return true;
  } catch (error: any) {
    Alert.alert('Export Failed', `Failed to export JSON: ${error.message}`);
    return false;
  }
}

// ─── EXPORT: JSON Download ────────────────────────────────────────────────────
export async function exportToJSONDownload(): Promise<boolean> {
  try {
    const { fileUri, filename } = await buildJSONFile();
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Error', 'Sharing is not available on this device');
      return false;
    }
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', UTI: 'com.apple.json' });
    return true;
  } catch (error: any) {
    Alert.alert('Export Failed', `Failed to export JSON: ${error.message}`);
    return false;
  }
}

// ─── EXPORT: Excel Share ───────────────────────────────────────────────────────
export async function exportToExcelShare(): Promise<boolean> {
  try {
    const { fileUri, filename } = await buildExcelFile();
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Error', 'Sharing is not available on this device');
      return false;
    }
    await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return true;
  } catch (error: any) {
    Alert.alert('Export Failed', `Failed to export Excel: ${error.message}`);
    return false;
  }
}

// ─── EXPORT: Excel Download ────────────────────────────────────────────────────
export async function exportToExcelDownload(): Promise<boolean> {
  try {
    const { fileUri, filename } = await buildExcelFile();
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Error', 'Sharing is not available on this device');
      return false;
    }
    await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return true;
  } catch (error: any) {
    Alert.alert('Export Failed', `Failed to export Excel: ${error.message}`);
    return false;
  }
}
