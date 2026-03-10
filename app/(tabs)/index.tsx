import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { getLowStockProducts, getAllSales, getDailySalesTotal, Product } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const router = useRouter();
  const { settings } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [todaysSales, setTodaysSales] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const lowStock = await getLowStockProducts();
      const sales = await getAllSales();
      const dailyTotal = await getDailySalesTotal(Date.now());

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();
      const todaysSalesCount = sales.filter((s) => s.createdAt >= todayTime).length;

      setLowStockProducts(lowStock);
      setTodaysSales(dailyTotal);
      setTotalTransactions(todaysSalesCount);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4 pt-4 pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-foreground">{settings.businessName}</Text>
            <Text className="text-sm text-muted mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            className="bg-surface border border-border rounded-lg p-3"
          >
            <MaterialIcons name="settings" size={24} color="#0a7ea4" />
          </TouchableOpacity>
        </View>

        {/* Key Metrics */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-primary/10 border border-primary rounded-lg p-4">
            <Text className="text-xs text-muted mb-2">Today's Sales</Text>
            <Text className="text-2xl font-bold text-primary">
              {settings.currency}{todaysSales.toFixed(2)}
            </Text>
            <Text className="text-xs text-muted mt-1">{totalTransactions} transaction(s)</Text>
          </View>

          <View className="flex-1 bg-success/10 border border-success rounded-lg p-4">
            <Text className="text-xs text-muted mb-2">Low Stock</Text>
            <Text className="text-2xl font-bold text-success">{lowStockProducts.length}</Text>
            <Text className="text-xs text-muted mt-1">Items to restock</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">Quick Actions</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/sales')}
              className="flex-1 bg-primary rounded-lg py-4 flex-row items-center justify-center"
            >
              <MaterialIcons name="add-shopping-cart" size={20} color="#fff" />
              <Text className="text-white font-semibold ml-2">New Sale</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/product-form')}
              className="flex-1 bg-surface border border-border rounded-lg py-4 flex-row items-center justify-center"
            >
              <MaterialIcons name="add" size={20} color="#0a7ea4" />
              <Text className="text-primary font-semibold ml-2">Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Low Stock Alerts */}
        {lowStockProducts.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-foreground">Low Stock Alerts</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/inventory')}>
                <Text className="text-primary text-sm font-semibold">View All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={lowStockProducts.slice(0, 3)}
              renderItem={({ item }) => (
                <View className="bg-warning/10 border border-warning rounded-lg p-3 mb-2">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">{item.name}</Text>
                      <Text className="text-xs text-muted">
                        Stock: {item.quantity} {item.unit} (Reorder: {item.reorderLevel})
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: '/product-form',
                          params: { productId: item.id },
                        })
                      }
                      className="bg-warning/20 px-3 py-1 rounded"
                    >
                      <Text className="text-warning text-xs font-semibold">Restock</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Quick Links */}
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-foreground">Quick Links</Text>
          </View>
          <View className="gap-2">
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/inventory')}
              className="bg-surface border border-border rounded-lg p-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="inventory-2" size={24} color="#0a7ea4" />
                <Text className="text-foreground font-semibold ml-3">Manage Inventory</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#687076" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/reports')}
              className="bg-surface border border-border rounded-lg p-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="bar-chart" size={24} color="#0a7ea4" />
                <Text className="text-foreground font-semibold ml-3">View Reports</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#687076" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/sales-history')}
              className="bg-surface border border-border rounded-lg p-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="receipt" size={24} color="#0a7ea4" />
                <Text className="text-foreground font-semibold ml-3">Sales History</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#687076" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
