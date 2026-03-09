import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { getAllSales, getExpensesByDateRange, getTotalInventoryValue } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';

export default function ReportsScreen() {
  const { settings } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalExpenses: 0,
    profit: 0,
    transactionCount: 0,
    averageTransaction: 0,
    inventoryValue: 0,
  });

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
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    return {
      startDate: startDate.getTime(),
      endDate: now.getTime(),
    };
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      const sales = await getAllSales();
      const expenses = await getExpensesByDateRange(startDate, endDate);
      const inventoryValue = await getTotalInventoryValue();

      const filteredSales = sales.filter((s) => s.createdAt >= startDate && s.createdAt <= endDate);
      const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const profit = totalSales - totalExpenses;
      const averageTransaction = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

      setMetrics({
        totalSales,
        totalExpenses,
        profit,
        transactionCount: filteredSales.length,
        averageTransaction,
        inventoryValue,
      });
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

  const profitMargin = metrics.totalSales > 0 ? ((metrics.profit / metrics.totalSales) * 100).toFixed(1) : '0.0';

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4 pt-4 pb-6">
        <Text className="text-3xl font-bold text-foreground mb-4">Reports</Text>

        {/* Period Selector */}
        <View className="flex-row gap-2 mb-6">
          {(['today', 'week', 'month', 'year'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                period === p
                  ? 'bg-primary border-primary'
                  : 'bg-surface border-border'
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

        {/* Revenue Card */}
        <View className="bg-primary/10 border border-primary rounded-lg p-6 mb-4">
          <View className="flex-row items-center mb-2">
            <MaterialIcons name="trending-up" size={24} color="#0a7ea4" />
            <Text className="text-sm text-muted ml-2">Total Revenue</Text>
          </View>
          <Text className="text-4xl font-bold text-primary">
            {settings.currency}{metrics.totalSales.toFixed(2)}
          </Text>
          <Text className="text-xs text-muted mt-2">
            {metrics.transactionCount} transaction(s)
          </Text>
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
        <View className={`bg-success/10 border border-success rounded-lg p-6 mb-4`}>
          <View className="flex-row items-center mb-2">
            <MaterialIcons
              name={metrics.profit >= 0 ? 'check-circle' : 'error'}
              size={24}
              color={metrics.profit >= 0 ? '#22C55E' : '#EF4444'}
            />
            <Text className="text-sm text-muted ml-2">Net Profit</Text>
          </View>
          <Text className={`text-4xl font-bold text-success`}>
            {settings.currency}{Math.abs(metrics.profit).toFixed(2)}
          </Text>
          <Text className={`text-xs mt-2 text-success`}>
            {metrics.profit >= 0 ? '+' : '-'}{profitMargin}% margin
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

        {/* Summary */}
        <View className="bg-surface border border-border rounded-lg p-4">
          <Text className="text-lg font-bold text-foreground mb-4">Summary</Text>
          <View className="space-y-3">
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
      </ScrollView>
    </ScreenContainer>
  );
}
