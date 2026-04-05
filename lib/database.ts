import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';

// Initialize database
const db = SQLite.openDatabaseSync('grocery-manager.db');

export interface Product {
  id: string;
  barcode: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  reorderLevel: number;
  unit: string;
  category?: string;
  imageUri?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  createdAt: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  createdAt: number;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  quantityChange: number;
  reason: string;
  createdAt: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyPoints: number;
  totalSpent: number;
  purchaseCount: number;
  lastPurchaseDate?: number;
  createdAt: number;
  updatedAt: number;
}

// Initialize database tables
export async function initializeDatabase() {
  try {
    // Products table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        costPrice REAL NOT NULL,
        sellingPrice REAL NOT NULL,
        quantity INTEGER NOT NULL,
        reorderLevel INTEGER NOT NULL,
        unit TEXT NOT NULL,
        category TEXT,
        imageUri TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

    // Sales table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        itemsJson TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount REAL NOT NULL,
        tax REAL NOT NULL,
        total REAL NOT NULL,
        paymentMethod TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `);

    // Expenses table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `);

    // Stock adjustments table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS stockAdjustments (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        quantityChange INTEGER NOT NULL,
        reason TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(productId) REFERENCES products(id)
      );
    `);

    // Customers table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        loyaltyPoints INTEGER NOT NULL DEFAULT 0,
        totalSpent REAL NOT NULL DEFAULT 0,
        purchaseCount INTEGER NOT NULL DEFAULT 0,
        lastPurchaseDate INTEGER,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Product operations
export async function addProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const id = uuidv4();
  const now = Date.now();
  const newProduct: Product = {
    ...product,
    id,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.runAsync(
      `INSERT INTO products (id, barcode, name, costPrice, sellingPrice, quantity, reorderLevel, unit, category, imageUri, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newProduct.id,
        newProduct.barcode,
        newProduct.name,
        newProduct.costPrice,
        newProduct.sellingPrice,
        newProduct.quantity,
        newProduct.reorderLevel,
        newProduct.unit,
        newProduct.category || null,
        newProduct.imageUri || null,
        newProduct.createdAt,
        newProduct.updatedAt,
      ]
    );
    return newProduct;
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
}

export async function getProduct(id: string): Promise<Product | null> {
  try {
    const result = await db.getFirstAsync<Product>(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );
    return result || null;
  } catch (error) {
    console.error('Error getting product:', error);
    throw error;
  }
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const result = await db.getFirstAsync<Product>(
      'SELECT * FROM products WHERE barcode = ?',
      [barcode]
    );
    return result || null;
  } catch (error) {
    console.error('Error getting product by barcode:', error);
    throw error;
  }
}

export async function getAllProducts(): Promise<Product[]> {
  try {
    const result = await db.getAllAsync<Product>(
      'SELECT * FROM products ORDER BY name ASC'
    );
    return result;
  } catch (error) {
    console.error('Error getting all products:', error);
    throw error;
  }
}

export async function searchProducts(query: string): Promise<Product[]> {
  try {
    const searchTerm = `%${query}%`;
    const result = await db.getAllAsync<Product>(
      'SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY name ASC',
      [searchTerm, searchTerm]
    );
    return result;
  } catch (error) {
    console.error('Error searching products:', error);
    throw error;
  }
}

export async function updateProduct(id: string, updates: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<Product | null> {
  try {
    const product = await getProduct(id);
    if (!product) return null;

    const updatedProduct: Product = {
      ...product,
      ...updates,
      updatedAt: Date.now(),
    };

    await db.runAsync(
      `UPDATE products SET barcode = ?, name = ?, costPrice = ?, sellingPrice = ?, quantity = ?, reorderLevel = ?, unit = ?, category = ?, imageUri = ?, updatedAt = ?
       WHERE id = ?`,
      [
        updatedProduct.barcode,
        updatedProduct.name,
        updatedProduct.costPrice,
        updatedProduct.sellingPrice,
        updatedProduct.quantity,
        updatedProduct.reorderLevel,
        updatedProduct.unit,
        updatedProduct.category || null,
        updatedProduct.imageUri || null,
        updatedProduct.updatedAt,
        id,
      ]
    );

    return updatedProduct;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

export async function getLowStockProducts(threshold?: number): Promise<Product[]> {
  try {
    const result = await db.getAllAsync<Product>(
      'SELECT * FROM products WHERE quantity <= reorderLevel ORDER BY quantity ASC'
    );
    return result;
  } catch (error) {
    console.error('Error getting low stock products:', error);
    throw error;
  }
}

// Sale operations
export async function addSale(sale: Omit<Sale, 'id' | 'createdAt'>): Promise<Sale> {
  const id = uuidv4();
  const now = Date.now();
  const newSale: Sale = {
    ...sale,
    id,
    createdAt: now,
  };

  try {
    // Add sale record
    await db.runAsync(
      `INSERT INTO sales (id, itemsJson, subtotal, discount, tax, total, paymentMethod, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newSale.id,
        JSON.stringify(newSale.items),
        newSale.subtotal,
        newSale.discount,
        newSale.tax,
        newSale.total,
        newSale.paymentMethod,
        newSale.createdAt,
      ]
    );

    // Deduct quantities from inventory
    for (const item of newSale.items) {
      const product = await getProduct(item.productId);
      if (product) {
        const newQuantity = product.quantity - item.quantity;
        await updateProduct(item.productId, { quantity: newQuantity });

        // Record stock adjustment
        await addStockAdjustment({
          productId: item.productId,
          quantityChange: -item.quantity,
          reason: `Sold in transaction ${newSale.id}`,
        });
      }
    }

    return newSale;
  } catch (error) {
    console.error('Error adding sale:', error);
    throw error;
  }
}

export async function getSale(id: string): Promise<Sale | null> {
  try {
    const result = await db.getFirstAsync<any>(
      'SELECT * FROM sales WHERE id = ?',
      [id]
    );
    if (!result) return null;

    return {
      ...result,
      items: JSON.parse(result.itemsJson),
    };
  } catch (error) {
    console.error('Error getting sale:', error);
    throw error;
  }
}

export async function getAllSales(): Promise<Sale[]> {
  try {
    const results = await db.getAllAsync<any>(
      'SELECT * FROM sales ORDER BY createdAt DESC'
    );
    return results.map(r => ({
      ...r,
      items: JSON.parse(r.itemsJson),
    }));
  } catch (error) {
    console.error('Error getting all sales:', error);
    throw error;
  }
}

export async function getSalesByDateRange(startDate: number, endDate: number): Promise<Sale[]> {
  try {
    const results = await db.getAllAsync<any>(
      'SELECT * FROM sales WHERE createdAt >= ? AND createdAt <= ? ORDER BY createdAt DESC',
      [startDate, endDate]
    );
    return results.map(r => ({
      ...r,
      items: JSON.parse(r.itemsJson),
    }));
  } catch (error) {
    console.error('Error getting sales by date range:', error);
    throw error;
  }
}

// Expense operations
export async function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
  const id = uuidv4();
  const now = Date.now();
  const newExpense: Expense = {
    ...expense,
    id,
    createdAt: now,
  };

  try {
    await db.runAsync(
      `INSERT INTO expenses (id, category, description, amount, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [newExpense.id, newExpense.category, newExpense.description, newExpense.amount, newExpense.createdAt]
    );
    return newExpense;
  } catch (error) {
    console.error('Error adding expense:', error);
    throw error;
  }
}

export async function getExpensesByDateRange(startDate: number, endDate: number): Promise<Expense[]> {
  try {
    const results = await db.getAllAsync<Expense>(
      'SELECT * FROM expenses WHERE createdAt >= ? AND createdAt <= ? ORDER BY createdAt DESC',
      [startDate, endDate]
    );
    return results;
  } catch (error) {
    console.error('Error getting expenses by date range:', error);
    throw error;
  }
}

export async function deleteExpense(id: string): Promise<boolean> {
  try {
    await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
}

// Stock adjustment operations
export async function addStockAdjustment(adjustment: Omit<StockAdjustment, 'id' | 'createdAt'>): Promise<StockAdjustment> {
  const id = uuidv4();
  const now = Date.now();
  const newAdjustment: StockAdjustment = {
    ...adjustment,
    id,
    createdAt: now,
  };

  try {
    await db.runAsync(
      `INSERT INTO stockAdjustments (id, productId, quantityChange, reason, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [newAdjustment.id, newAdjustment.productId, newAdjustment.quantityChange, newAdjustment.reason, newAdjustment.createdAt]
    );
    return newAdjustment;
  } catch (error) {
    console.error('Error adding stock adjustment:', error);
    throw error;
  }
}

export async function getStockAdjustmentsByProduct(productId: string): Promise<StockAdjustment[]> {
  try {
    const results = await db.getAllAsync<StockAdjustment>(
      'SELECT * FROM stockAdjustments WHERE productId = ? ORDER BY createdAt DESC',
      [productId]
    );
    return results;
  } catch (error) {
    console.error('Error getting stock adjustments:', error);
    throw error;
  }
}

// Analytics operations
export async function getTotalInventoryValue(): Promise<number> {
  try {
    const result = await db.getFirstAsync<{ total: number }>(
      'SELECT SUM(quantity * costPrice) as total FROM products'
    );
    return result?.total || 0;
  } catch (error) {
    console.error('Error calculating inventory value:', error);
    throw error;
  }
}

export async function getDailySalesTotal(date: number): Promise<number> {
  try {
    const startOfDay = Math.floor(date / 86400000) * 86400000;
    const endOfDay = startOfDay + 86400000;

    const result = await db.getFirstAsync<{ total: number }>(
      'SELECT SUM(total) as total FROM sales WHERE createdAt >= ? AND createdAt < ?',
      [startOfDay, endOfDay]
    );
    return result?.total || 0;
  } catch (error) {
    console.error('Error getting daily sales total:', error);
    throw error;
  }
}

export async function getMonthlySalesTotal(year: number, month: number): Promise<number> {
  try {
    const startDate = new Date(year, month - 1, 1).getTime();
    const endDate = new Date(year, month, 1).getTime();

    const result = await db.getFirstAsync<{ total: number }>(
      'SELECT SUM(total) as total FROM sales WHERE createdAt >= ? AND createdAt < ?',
      [startDate, endDate]
    );
    return result?.total || 0;
  } catch (error) {
    console.error('Error getting monthly sales total:', error);
    throw error;
  }
}

export async function getMonthlyExpensesTotal(year: number, month: number): Promise<number> {
  try {
    const startDate = new Date(year, month - 1, 1).getTime();
    const endDate = new Date(year, month, 1).getTime();

    const result = await db.getFirstAsync<{ total: number }>(
      'SELECT SUM(amount) as total FROM expenses WHERE createdAt >= ? AND createdAt < ?',
      [startDate, endDate]
    );
    return result?.total || 0;
  } catch (error) {
    console.error('Error getting monthly expenses total:', error);
    throw error;
  }
}

export async function getTopSellingProducts(limit: number = 10): Promise<any[]> {
  try {
    // This is a simplified version - in production, you'd want to aggregate from sales items
    const results = await db.getAllAsync<any>(
      'SELECT * FROM products ORDER BY quantity DESC LIMIT ?',
      [limit]
    );
    return results;
  } catch (error) {
    console.error('Error getting top selling products:', error);
    throw error;
  }
}

// Customer operations
export async function addCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
  const id = uuidv4();
  const now = Date.now();
  const newCustomer: Customer = {
    ...customer,
    id,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.runAsync(
      `INSERT INTO customers (id, name, phone, email, loyaltyPoints, totalSpent, purchaseCount, lastPurchaseDate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newCustomer.id,
        newCustomer.name,
        newCustomer.phone || null,
        newCustomer.email || null,
        newCustomer.loyaltyPoints,
        newCustomer.totalSpent,
        newCustomer.purchaseCount,
        newCustomer.lastPurchaseDate || null,
        newCustomer.createdAt,
        newCustomer.updatedAt,
      ]
    );
    return newCustomer;
  } catch (error) {
    console.error('Error adding customer:', error);
    throw error;
  }
}

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const results = await db.getAllAsync<Customer>('SELECT * FROM customers ORDER BY totalSpent DESC');
    return results;
  } catch (error) {
    console.error('Error getting all customers:', error);
    throw error;
  }
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  try {
    const result = await db.getFirstAsync<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
    return result || null;
  } catch (error) {
    console.error('Error getting customer:', error);
    throw error;
  }
}

export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  try {
    const result = await db.getFirstAsync<Customer>('SELECT * FROM customers WHERE phone = ?', [phone]);
    return result || null;
  } catch (error) {
    console.error('Error getting customer by phone:', error);
    throw error;
  }
}

export async function updateCustomer(id: string, updates: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<Customer> {
  try {
    const customer = await getCustomerById(id);
    if (!customer) throw new Error('Customer not found');

    const updated: Customer = {
      ...customer,
      ...updates,
      updatedAt: Date.now(),
    };

    await db.runAsync(
      `UPDATE customers SET name = ?, phone = ?, email = ?, loyaltyPoints = ?, totalSpent = ?, purchaseCount = ?, lastPurchaseDate = ?, updatedAt = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.phone || null,
        updated.email || null,
        updated.loyaltyPoints,
        updated.totalSpent,
        updated.purchaseCount,
        updated.lastPurchaseDate || null,
        updated.updatedAt,
        id,
      ]
    );
    return updated;
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
}

export async function addLoyaltyPoints(customerId: string, points: number): Promise<Customer> {
  try {
    const customer = await getCustomerById(customerId);
    if (!customer) throw new Error('Customer not found');

    return updateCustomer(customerId, {
      loyaltyPoints: customer.loyaltyPoints + points,
    });
  } catch (error) {
    console.error('Error adding loyalty points:', error);
    throw error;
  }
}

export async function deleteCustomer(id: string): Promise<boolean> {
  try {
    await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
}

export async function clearAllData(): Promise<boolean> {
  try {
    await db.execAsync('DELETE FROM sales; DELETE FROM expenses; DELETE FROM stockAdjustments; DELETE FROM products; DELETE FROM customers;');
    return true;
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw error;
  }
}

export async function exportData(): Promise<string> {
  try {
    const products = await getAllProducts();
    const sales = await getAllSales();
    const expenses = await db.getAllAsync<Expense>('SELECT * FROM expenses');

    const exportData = {
      products,
      sales,
      expenses,
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}
