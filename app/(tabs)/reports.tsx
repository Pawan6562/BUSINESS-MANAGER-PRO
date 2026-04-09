import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { getAllSales, getExpensesByDateRange, getTotalInventoryValue, getAllProducts } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';

interface DailySalesData {
  date: string;
  sales: number;
  transactions: number;
}

interface ProductAnalytics {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
  profitMargin: number;
}

export default function ReportsScreen() {
  const { settings } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'trends'>('overview');

  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalExpenses: 0,
    profit: 0,
    transactionCount: 0,
    averageTransaction: 0,
    inventoryValue: 0,
    profitMargin: 0,
  });

  const [dailySalesData, setDailySalesData] = useState<DailySalesData[]>([]);
  const [topProducts, setTopProducts] = useState<ProductAnalytics[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<{ category: string; amount: number }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ method: string; count: number; total: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [period])
  );

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    return {
      startDate: startDate.getTime(),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime(),
    };
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      // Load sales and expenses
      const sales = await getAllSales();
      const expenses = await getExpensesByDateRange(startDate, endDate);
      const inventoryValue = await getTotalInventoryValue();
      const allProducts = await getAllProducts();

      // Filter sales by date range
      const filteredSales = sales.filter((s) => s.createdAt >= startDate && s.createdAt <= endDate);
      const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
      
      // Calculate Cost of Goods Sold (COGS)
      let totalCOGS = 0;
      filteredSales.forEach((sale) => {
        sale.items.forEach((item) => {
          const product = allProducts.find((p) => p.id === item.productId);
          const costPrice = product?.costPrice || 0;
          totalCOGS += costPrice * item.quantity;
        });
      });
      
      // Get manually added expenses
      const totalManualExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      
      // Calculate total expenses and profit
      const totalExpenses = totalCOGS + totalManualExpenses;
      const profit = totalSales - totalExpenses;
      const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;
      const averageTransaction = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

      // Calculate daily sales data
      const dailyMap = new Map<string, { sales: number; transactions: number }>();
      filteredSales.forEach((sale) => {
        const date = new Date(sale.createdAt).toLocaleDateString();
        const existing = dailyMap.get(date) || { sales: 0, transactions: 0 };
        dailyMap.set(date, {
          sales: existing.sales + sale.total,
          transactions: existing.transactions + 1,
        });
      });

      const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));

      // Calculate product analytics
      const productMap = new Map<string, { quantity: number; revenue: number; cost: number }>();
      filteredSales.forEach((sale) => {
        sale.items.forEach((item) => {
          const existing = productMap.get(item.productId) || { quantity: 0, revenue: 0, cost: 0 };
          const product = allProducts.find((p) => p.id === item.productId);
          const itemCost = product ? product.costPrice * item.quantity : 0;
          productMap.set(item.productId, {
            quantity: existing.quantity + item.quantity,
            revenue: existing.revenue + item.subtotal,
            cost: existing.cost + itemCost,
          });
        });
      });

      const topProductsList = await Promise.all(
        Array.from(productMap.entries()).map(async ([productId, data]) => {
          const product = allProducts.find((p) => p.id === productId);
          const profit = data.revenue - data.cost;
          const profitMargin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
          return {
            productId,
            name: product?.name || 'Unknown',
            quantity: data.quantity,
            revenue: data.revenue,
            profit,
            profitMargin,
          };
        })
      );

      // Sort by revenue
      topProductsList.sort((a, b) => b.revenue - a.revenue);

      // Calculate expenses by category
      const expenseMap = new Map<string, number>();
      expenses.forEach((exp) => {
        const existing = expenseMap.get(exp.category) || 0;
        expenseMap.set(exp.category, existing + exp.amount);
      });

      const expensesByCat = Array.from(expenseMap.entries()).map(([category, amount]) => ({
        category,
        amount,
      }));

      // Calculate payment methods
      const paymentMap = new Map<string, { count: number; total: number }>();
      filteredSales.forEach((sale) => {
        const method = sale.paymentMethod || 'Unknown';
        const existing = paymentMap.get(method) || { count: 0, total: 0 };
        paymentMap.set(method, {
          count: existing.count + 1,
          total: existing.total + sale.total,
        });
      });

      const paymentData = Array.from(paymentMap.entries()).map(([method, data]) => ({
        method,
        ...data,
      }));

      setMetrics({
        totalSales,
        totalExpenses,
        profit,
        transactionCount: filteredSales.length,
        averageTransaction,
        inventoryValue,
        profitMargin,
      });

      setDailySalesData(dailyData);
      setTopProducts(topProductsList.slice(0, 10));
      setExpensesByCategory(expensesByCat);
      setPaymentMethods(paymentData);
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    const now = new Date();
    switch (period) {
      case 'today':
        return now.toLocaleDateString();
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
      case 'month':
        return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'year':
        return now.getFullYear().toString();
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }} className="px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4">
          <Text className="text-3xl font-bold text-foreground">Reports</Text>
          <Text className="text-sm text-muted mt-1">Business Analytics & Insights</Text>
        </View>

        {/* Period Selector */}
        <View className="flex-row gap-2 mb-6">
          {(['today', 'week', 'month', 'year'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                period === p ? 'bg-primary border-primary' : 'bg-surface border-border'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  period === p ? 'text-white' : 'text-foreground'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Period Label */}
        <Text className="text-sm text-muted text-center mb-6">{getPeriodLabel()}</Text>

        {/* Tab Navigation */}
        <View className="flex-row gap-2 mb-6">
          {(['overview', 'products', 'trends'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === tab ? 'bg-primary border-primary' : 'bg-surface border-border'
              }`}
            >
              <Text
                className={`text-center font-semibold text-xs ${
                  activeTab === tab ? 'text-white' : 'text-foreground'
                }`}
              >
                {tab === 'overview' && 'Overview'}
                {tab === 'products' && 'Products'}
                {tab === 'trends' && 'Trends'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Revenue Card */}
            <View className="bg-primary/10 border border-primary rounded-lg p-6 mb-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="trending-up" size={24} color="#0a7ea4" />
                <Text className="text-sm text-muted ml-2">Total Revenue</Text>
              </View>
              <Text className="text-4xl font-bold text-primary">
                {settings.currency}{metrics.totalSales.toFixed(2)}
              </Text>
              <Text className="text-xs text-muted mt-2">{metrics.transactionCount} transaction(s)</Text>
            </View>

            {/* Expenses Card */}
            <View className="bg-error/10 border border-error rounded-lg p-6 mb-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="trending-down" size={24} color="#EF4444" />
                <Text className="text-sm text-muted ml-2">Total Expenses</Text>
              </View>
              <Text className="text-4xl font-bold text-error">
                {settings.currency}{metrics.totalExpenses.toFixed(2)}
              </Text>
            </View>

            {/* Profit Card */}
            <View className="bg-success/10 border border-success rounded-lg p-6 mb-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons
                  name={metrics.profit >= 0 ? 'check-circle' : 'error'}
                  size={24}
                  color={metrics.profit >= 0 ? '#22C55E' : '#EF4444'}
                />
                <Text className="text-sm text-muted ml-2">Net Profit</Text>
              </View>
              <Text className="text-4xl font-bold text-success">
                {settings.currency}{Math.abs(metrics.profit).toFixed(2)}
              </Text>
              <Text className="text-xs mt-2 text-success">
                {metrics.profit >= 0 ? '+' : '-'}{Math.abs(metrics.profitMargin).toFixed(1)}% margin
              </Text>
            </View>

            {/* Key Metrics Grid */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 bg-surface border border-border rounded-lg p-4">
                <Text className="text-xs text-muted mb-2">Avg Transaction</Text>
                <Text className="text-2xl font-bold text-foreground">
                  {settings.currency}{metrics.averageTransaction.toFixed(2)}
                </Text>
              </View>
              <View className="flex-1 bg-surface border border-border rounded-lg p-4">
                <Text className="text-xs text-muted mb-2">Inventory Value</Text>
                <Text className="text-2xl font-bold text-foreground">
                  {settings.currency}{metrics.inventoryValue.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Payment Methods */}
            {paymentMethods.length > 0 && (
              <View className="bg-surface border border-border rounded-lg p-4 mb-4">
                <Text className="text-lg font-bold text-foreground mb-3">Payment Methods</Text>
                {paymentMethods.map((method, idx) => (
                  <View key={idx} className="flex-row justify-between items-center pb-3 border-b border-border last:border-b-0">
                    <View>
                      <Text className="font-semibold text-foreground capitalize">{method.method}</Text>
                      <Text className="text-xs text-muted">{method.count} transaction(s)</Text>
                    </View>
                    <Text className="font-bold text-primary">
                      {settings.currency}{method.total.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Expenses by Category */}
            {expensesByCategory.length > 0 && (
              <View className="bg-surface border border-border rounded-lg p-4 mb-4">
                <Text className="text-lg font-bold text-foreground mb-3">Expenses by Category</Text>
                {expensesByCategory.map((exp, idx) => (
                  <View key={idx} className="flex-row justify-between items-center pb-3 border-b border-border last:border-b-0">
                    <Text className="text-muted capitalize">{exp.category}</Text>
                    <Text className="font-semibold text-error">
                      {settings.currency}{exp.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Summary */}
            <View className="bg-surface border border-border rounded-lg p-4">
              <Text className="text-lg font-bold text-foreground mb-4">Summary</Text>
              <View>
                <View className="flex-row justify-between items-center pb-3 border-b border-border">
                  <Text className="text-muted">Transactions</Text>
                  <Text className="font-semibold text-foreground">{metrics.transactionCount}</Text>
                </View>
                <View className="flex-row justify-between items-center pb-3 border-b border-border">
                  <Text className="text-muted">Revenue</Text>
                  <Text className="font-semibold text-foreground">
                    {settings.currency}{metrics.totalSales.toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center pb-3 border-b border-border">
                  <Text className="text-muted">Expenses</Text>
                  <Text className="font-semibold text-foreground">
                    {settings.currency}{metrics.totalExpenses.toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-muted">Net Profit</Text>
                  <Text className="font-bold text-success">
                    {settings.currency}{metrics.profit.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <>
            {topProducts.length > 0 ? (
              <View className="bg-surface border border-border rounded-lg p-4">
                <Text className="text-lg font-bold text-foreground mb-4">Top Selling Products</Text>
                {topProducts.map((product, idx) => (
                  <View key={idx} className="pb-4 border-b border-border last:border-b-0">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1">
                        <Text className="font-semibold text-foreground">{product.name}</Text>
                        <Text className="text-xs text-muted mt-1">
                          {product.quantity} unit(s) sold
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-bold text-primary">
                          {settings.currency}{product.revenue.toFixed(2)}
                        </Text>
                        <Text className="text-xs text-success mt-1">
                          +{product.profitMargin.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <View className="bg-background rounded p-2">
                      <View className="flex-row justify-between text-xs text-muted">
                        <Text className="text-xs text-muted">Profit: {settings.currency}{product.profit.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="bg-surface border border-border rounded-lg p-6 items-center">
                <MaterialIcons name="shopping-cart" size={40} color="#687076" />
                <Text className="text-muted text-center mt-2">No sales data available</Text>
              </View>
            )}
          </>
        )}

        {/* TRENDS TAB */}
        {activeTab === 'trends' && (
          <>
            {dailySalesData.length > 0 ? (
              <View className="bg-surface border border-border rounded-lg p-4 mb-4">
                <Text className="text-lg font-bold text-foreground mb-4">Daily Sales Trend</Text>
                {dailySalesData.map((day, idx) => {
                  const maxSales = Math.max(...dailySalesData.map((d) => d.sales), 1);
                  const barWidth = (day.sales / maxSales) * 100;
                  return (
                    <View key={idx} className="mb-4">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-sm font-semibold text-foreground">{day.date}</Text>
                        <Text className="text-sm font-bold text-primary">
                          {settings.currency}{day.sales.toFixed(2)}
                        </Text>
                      </View>
                      <View className="bg-background rounded-full h-2 overflow-hidden">
                        <View
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </View>
                      <Text className="text-xs text-muted mt-1">{day.transactions} transaction(s)</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="bg-surface border border-border rounded-lg p-6 items-center">
                <MaterialIcons name="show-chart" size={40} color="#687076" />
                <Text className="text-muted text-center mt-2">No trend data available</Text>
              </View>
            )}

            {/* Growth Metrics */}
            <View className="bg-surface border border-border rounded-lg p-4">
              <Text className="text-lg font-bold text-foreground mb-4">Key Metrics</Text>
              <View className="space-y-3">
                <View className="flex-row justify-between items-center pb-3 border-b border-border">
                  <Text className="text-muted">Avg Daily Sales</Text>
                  <Text className="font-semibold text-foreground">
                    {settings.currency}
                    {(metrics.totalSales / Math.max(dailySalesData.length, 1)).toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center pb-3 border-b border-border">
                  <Text className="text-muted">Peak Day</Text>
                  <Text className="font-semibold text-foreground">
                    {settings.currency}
                    {Math.max(...dailySalesData.map((d) => d.sales), 0).toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-muted">Lowest Day</Text>
                  <Text className="font-semibold text-foreground">
                    {settings.currency}
                    {Math.min(...dailySalesData.map((d) => d.sales), 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Footer Branding */}
        <View className="items-center gap-1 py-3 border-t border-border mt-4">
          <Text className="text-xs text-muted">Powered by</Text>
          <Text className="text-xs font-bold text-primary">PRIMEVECTOR STUDIO</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
