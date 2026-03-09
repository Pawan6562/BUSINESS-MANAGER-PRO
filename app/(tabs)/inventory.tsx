import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { getAllProducts, getLowStockProducts, Product, deleteProduct } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function InventoryScreen() {
  const router = useRouter();
  const { settings } = useAppStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const loadProducts = async () => {
    try {
      setLoading(true);
      const allProducts = await getAllProducts();
      setProducts(allProducts);
      setFilteredProducts(allProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.barcode.includes(query)
      );
      setFilteredProducts(filtered);
    }
  };

  const handleDeleteProduct = (productId: string) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteProduct(productId);
              loadProducts();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete product');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleEditProduct = (product: Product) => {
    router.push({
      pathname: '/product-form',
      params: { productId: product.id },
    });
  };

  const getStockStatus = (quantity: number, reorderLevel: number) => {
    if (quantity === 0) return { color: '#EF4444', label: 'Out of Stock' };
    if (quantity <= reorderLevel) return { color: '#F59E0B', label: 'Low Stock' };
    return { color: '#22C55E', label: 'In Stock' };
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const status = getStockStatus(item.quantity, item.reorderLevel);
    const profit = (item.sellingPrice - item.costPrice) * item.quantity;

    return (
      <TouchableOpacity
        onPress={() => handleEditProduct(item)}
        className="bg-surface border border-border rounded-lg p-4 mb-3 mx-4"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
            <Text className="text-sm text-muted">Barcode: {item.barcode}</Text>
          </View>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: status.color + '20' }}
          >
            <Text style={{ color: status.color }} className="text-xs font-semibold">
              {status.label}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center mb-2">
          <View>
            <Text className="text-xs text-muted">Quantity</Text>
            <Text className="text-lg font-bold text-foreground">
              {item.quantity} {item.unit}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-muted">Cost</Text>
            <Text className="text-lg font-bold text-foreground">
              {settings.currency}{item.costPrice.toFixed(2)}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-muted">Selling</Text>
            <Text className="text-lg font-bold text-foreground">
              {settings.currency}{item.sellingPrice.toFixed(2)}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center pt-2 border-t border-border">
          <Text className="text-sm text-success font-semibold">
            Profit: {settings.currency}{profit.toFixed(2)}
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => handleEditProduct(item)}
              className="bg-primary px-3 py-2 rounded-lg"
            >
              <MaterialIcons name="edit" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteProduct(item.id)}
              className="bg-error px-3 py-2 rounded-lg"
            >
              <MaterialIcons name="delete" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
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

  return (
    <ScreenContainer className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-3xl font-bold text-foreground mb-4">Inventory</Text>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-2 mb-4">
          <MaterialIcons name="search" size={20} color="#687076" />
          <TextInput
            placeholder="Search products..."
            placeholderTextColor="#687076"
            value={searchQuery}
            onChangeText={handleSearch}
            className="flex-1 ml-2 text-foreground"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <MaterialIcons name="close" size={20} color="#687076" />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-surface border border-border rounded-lg p-3">
            <Text className="text-xs text-muted">Total Items</Text>
            <Text className="text-xl font-bold text-foreground">{products.length}</Text>
          </View>
          <View className="flex-1 bg-surface border border-border rounded-lg p-3">
            <Text className="text-xs text-muted">Low Stock</Text>
            <Text className="text-xl font-bold text-warning">
              {products.filter((p) => p.quantity <= p.reorderLevel).length}
            </Text>
          </View>
          <View className="flex-1 bg-surface border border-border rounded-lg p-3">
            <Text className="text-xs text-muted">Out of Stock</Text>
            <Text className="text-xl font-bold text-error">
              {products.filter((p) => p.quantity === 0).length}
            </Text>
          </View>
        </View>
      </View>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <MaterialIcons name="inbox" size={48} color="#687076" />
          <Text className="text-lg font-semibold text-foreground mt-4 text-center">
            {searchQuery ? 'No products found' : 'No products yet'}
          </Text>
          <Text className="text-sm text-muted text-center mt-2">
            {searchQuery ? 'Try a different search' : 'Add your first product to get started'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          scrollEnabled={true}
        />
      )}

      {/* Add Product Button */}
      <TouchableOpacity
        onPress={() => router.push('/product-form')}
        className="absolute bottom-6 right-6 bg-primary rounded-full p-4 shadow-lg"
      >
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </ScreenContainer>
  );
}
