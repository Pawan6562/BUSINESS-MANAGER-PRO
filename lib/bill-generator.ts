import { Sale, SaleItem } from './database';

export function generateBillText(
  sale: Sale,
  businessName: string,
  currency: string
): string {
  const date = new Date(sale.createdAt);
  const formattedDate = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  
  const formattedTime = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const billNumber = sale.id.substring(0, 8).toUpperCase();

  let billText = '';
  billText += '================================\n';
  billText += '  Powered by Business Manager Pro\n';
  billText += '================================\n';
  billText += `${businessName.padStart((32 + businessName.length) / 2, ' ').padEnd(32, ' ')}\n`;
  billText += '================================\n';
  billText += `Date : ${formattedDate}\n`;
  billText += `Time : ${formattedTime}\n`;
  billText += `Bill : #${billNumber}\n`;
  billText += '--------------------------------\n';
  billText += 'ITEMS\n';
  billText += '--------------------------------\n';

  // Add items
  if (sale.items && sale.items.length > 0) {
    sale.items.forEach((item: SaleItem) => {
      billText += `${item.productName}\n`;
      billText += `  Qty: ${item.quantity}  x  ${currency}${item.unitPrice.toFixed(2)}  =  ${currency}${item.subtotal.toFixed(2)}\n\n`;
    });
  }

  billText += '--------------------------------\n';
  billText += `Subtotal  :  ${currency}${sale.subtotal.toFixed(2)}\n`;

  // Only include discount if it's not 0
  if (sale.discount && sale.discount > 0) {
    billText += `Discount  :  ${currency}${sale.discount.toFixed(2)}\n`;
  }

  // Only include tax if it's not 0
  if (sale.tax && sale.tax > 0) {
    billText += `Tax       :  ${currency}${sale.tax.toFixed(2)}\n`;
  }

  billText += '--------------------------------\n';
  billText += `TOTAL     :  ${currency}${sale.total.toFixed(2)}\n`;
  billText += '--------------------------------\n';
  billText += `Payment   :  ${sale.paymentMethod || 'CASH'}\n`;
  billText += '================================\n\n';
  billText += '  Thank you for your purchase!\n';
  billText += '  Visit us again :)\n\n';
  billText += '================================\n';

  return billText;
}
