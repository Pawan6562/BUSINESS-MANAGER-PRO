import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { getAllSales, Sale } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';
import { generateBillText } from '@/lib/bill-generator';
import { BillPreviewModal } from '@/components/BillPreviewModal';

export default function SalesHistoryScreen() {
  const router = useRouter();
  const { settings } = useAppStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showBillPreview, setShowBillPreview] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSales();
    }, [])
  );

  const loadSales = async () => {
    try {
      setLoading(true);
      const allSales = await getAllSales();
      setSales(allSales);
      setFilteredSales(allSales);
    } catch (error) {
      console.error('Error loading sales:', error);
      Alert.alert('Error', 'Failed to load sales history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getTodaysSales = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    return sales.filter((sale) => sale.createdAt >= todayTime);
  };

  const getTotalSales = () => {
    return sales.reduce((sum, sale) => sum + sale.total, 0);
  };

  const renderSaleItem = ({ item }: { item: Sale }) => {
    return (
      <TouchableOpacity
        onPress={() => setSelectedSale(item)}
        className="bg-surface border border-border rounded-lg p-4 mb-3 mx-4"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">
              {item.items.length} item(s)
            </Text>
            <Text className="text-sm text-muted">{formatDate(item.createdAt)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-xl font-bold text-primary">
              {settings.currency}{item.total.toFixed(2)}
            </Text>
            <Text className="text-xs text-muted capitalize">{item.paymentMethod}</Text>
          </View>
        </View>

        <View className="flex-row justify-between pt-2 border-t border-border">
          <Text className="text-xs text-muted">
            Subtotal: {settings.currency}{item.subtotal.toFixed(2)}
          </Text>
          {item.discount > 0 && (
            <Text className="text-xs text-success">
              Discount: {settings.currency}{item.discount.toFixed(2)}
            </Text>
          )}
          {item.tax > 0 && (
            <Text className="text-xs text-muted">
              Tax: {settings.currency}{item.tax.toFixed(2)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (selectedSale) {
    return (
      <ScreenContainer className="flex-1 bg-background">
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-3xl font-bold text-foreground">Receipt</Text>
            <TouchableOpacity onPress={() => setSelectedSale(null)}>
              <MaterialIcons name="close" size={28} color="#11181C" />
            </TouchableOpacity>
          </View>

          {/* Receipt Details */}
          <View className="bg-surface border border-border rounded-lg p-4 mb-4">
            <Text className="text-sm text-muted mb-4">
              {formatDate(selectedSale.createdAt)}
            </Text>

            {/* Items */}
            <View className="mb-4">
              <Text className="text-lg font-bold text-foreground mb-2">Items</Text>
              {selectedSale.items.map((item, index) => (
                <View key={index} className="flex-row justify-between py-2 border-b border-border">
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">{item.productName}</Text>
                    <Text className="text-xs text-muted">
                      {settings.currency}{item.unitPrice.toFixed(2)} x {item.quantity}
                    </Text>
                  </View>
                  <Text className="font-semibold text-foreground">
                    {settings.currency}{item.subtotal.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View className="border-t border-border pt-3">
              <View className="flex-row justify-between mb-2">
                <Text className="text-muted">Subtotal</Text>
                <Text className="font-semibold text-foreground">
                  {settings.currency}{selectedSale.subtotal.toFixed(2)}
                </Text>
              </View>
              {selectedSale.discount > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-muted">Discount</Text>
                  <Text className="font-semibold text-success">
                    -{settings.currency}{selectedSale.discount.toFixed(2)}
                  </Text>
                </View>
              )}
              {selectedSale.tax > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-muted">Tax</Text>
                  <Text className="font-semibold text-foreground">
                    {settings.currency}{selectedSale.tax.toFixed(2)}
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between border-t border-border pt-2 mt-2">
                <Text className="text-lg font-bold text-foreground">Total</Text>
                <Text className="text-lg font-bold text-primary">
                  {settings.currency}{selectedSale.total.toFixed(2)}
                </Text>
              </View>
            </View>

            <View className="mt-4 pt-4 border-t border-border">
              <Text className="text-sm text-muted text-center capitalize">
                Payment: {selectedSale.paymentMethod}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-2 mb-3">
            <TouchableOpacity
              onPress={() => setShowBillPreview(true)}
              className="flex-1 bg-primary rounded-lg py-4 flex-row items-center justify-center"
            >
              <MaterialIcons name="share" size={20} color="#fff" />
              <Text className="text-white font-semibold ml-2">Send Bill</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedSale(null)}
              className="flex-1 bg-surface border border-border rounded-lg py-4 flex-row items-center justify-center"
            >
              <Text className="text-foreground font-semibold">Back</Text>
            </TouchableOpacity>
          </View>

          {/* Bill Preview Modal */}
          {selectedSale && (
            <BillPreviewModal
              visible={showBillPreview}
              billText={generateBillText(selectedSale, settings.businessName, settings.currency)}
              businessName={settings.businessName}
              onClose={() => setShowBillPreview(false)}
              onShare={async () => {
                try {
                  await Share.share({
                    message: generateBillText(selectedSale, settings.businessName, settings.currency),
                    title: `Bill from ${settings.businessName}`,
                  });
                  setShowBillPreview(false);
                } catch (error) {
                  Alert.alert('Error', 'Failed to share bill');
                }
              }}
            />
          )}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-3xl font-bold text-foreground">Sales History</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="close" size={28} color="#11181C" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-surface border border-border rounded-lg p-3">
            <Text className="text-xs text-muted">Today's Sales</Text>
            <Text className="text-xl font-bold text-foreground">
              {getTodaysSales().length}
            </Text>
          </View>
          <View className="flex-1 bg-surface border border-border rounded-lg p-3">
            <Text className="text-xs text-muted">Total Revenue</Text>
            <Text className="text-xl font-bold text-primary">
              {settings.currency}{getTotalSales().toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Sales List */}
      {sales.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <MaterialIcons name="receipt" size={48} color="#687076" />
          <Text className="text-lg font-semibold text-foreground mt-4 text-center">
            No Sales Yet
          </Text>
          <Text className="text-sm text-muted text-center mt-2">
            Your sales history will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSales}
          renderItem={renderSaleItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          scrollEnabled={true}
        />
      )}
    </ScreenContainer>
  );
}
