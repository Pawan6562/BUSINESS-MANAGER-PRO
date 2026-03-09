import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { getAllProducts, addSale, Product } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';

export default function SalesScreen() {
  const router = useRouter();
  const { settings, cartItems, addToCart, removeFromCart, updateCartQuantity, clearCart, discount, setDiscount, paymentMethod, setPaymentMethod } = useAppStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState(0);

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

  const handleAddToCart = (product: Product) => {
    if (product.quantity <= 0) {
      Alert.alert('Out of Stock', `${product.name} is out of stock`);
      return;
    }
    addToCart(product, 1);
  };

  const calculateTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      return sum + (product?.sellingPrice || 0) * item.quantity;
    }, 0);

    const discountAmount = (subtotal * discount) / 100;
    const taxableAmount = subtotal - discountAmount;
    const tax = (taxableAmount * settings.taxPercentage) / 100;
    const total = taxableAmount + tax;

    return { subtotal, discountAmount, tax, total };
  };

  const { subtotal, discountAmount, tax, total } = calculateTotals();

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to the cart');
      return;
    }

    setProcessing(true);
    try {
      const saleItems = cartItems.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown',
          quantity: item.quantity,
          unitPrice: product?.sellingPrice || 0,
          subtotal: (product?.sellingPrice || 0) * item.quantity,
        };
      });

      await addSale({
        items: saleItems,
        subtotal,
        discount: discountAmount,
        tax,
        total,
        paymentMethod,
      });

      setLastSaleTotal(total);
      setShowReceipt(true);
      clearCart();
      setSearchQuery('');
      loadProducts();
    } catch (error) {
      Alert.alert('Error', 'Failed to process sale');
    } finally {
      setProcessing(false);
    }
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const isInCart = cartItems.some((ci) => ci.productId === item.id);
    return (
      <TouchableOpacity
        onPress={() => handleAddToCart(item)}
        disabled={item.quantity === 0}
        className={`bg-surface border rounded-lg p-3 mb-2 mx-4 ${
          item.quantity === 0 ? 'opacity-50' : ''
        } ${isInCart ? 'border-primary' : 'border-border'}`}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="font-semibold text-foreground">{item.name}</Text>
            <Text className="text-xs text-muted">
              {settings.currency}{item.sellingPrice.toFixed(2)} • Stock: {item.quantity}
            </Text>
          </View>
          {isInCart && <MaterialIcons name="check-circle" size={20} color="#22C55E" />}
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

  if (showReceipt) {
    return (
      <ScreenContainer className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4 pt-4">
          <View className="flex-1 items-center justify-center">
            <MaterialIcons name="check-circle" size={64} color="#22C55E" />
            <Text className="text-2xl font-bold text-foreground mt-4">Sale Completed!</Text>
            <Text className="text-4xl font-bold text-primary mt-4">
              {settings.currency}{lastSaleTotal.toFixed(2)}
            </Text>
            <Text className="text-sm text-muted mt-2">Total Amount</Text>
          </View>

          <View className="gap-3 pb-6">
            <TouchableOpacity
              onPress={() => setShowReceipt(false)}
              className="bg-primary rounded-lg py-4 flex-row items-center justify-center"
            >
              <MaterialIcons name="add" size={24} color="#fff" />
              <Text className="text-white font-semibold ml-2">New Sale</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/sales-history')}
              className="bg-surface border border-border rounded-lg py-4 flex-row items-center justify-center"
            >
              <MaterialIcons name="receipt" size={24} color="#0a7ea4" />
              <Text className="text-primary font-semibold ml-2">View Receipt</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1 bg-background">
      <View className="flex-row gap-2 px-4 pt-4 pb-2">
        <View className="flex-1">
          <Text className="text-3xl font-bold text-foreground">Sales</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/sales-history')}
          className="bg-surface border border-border rounded-lg px-3 py-2 flex-row items-center"
        >
          <MaterialIcons name="history" size={20} color="#0a7ea4" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-2 mx-4 mb-4">
        <MaterialIcons name="search" size={20} color="#687076" />
        <TextInput
          placeholder="Search products..."
          placeholderTextColor="#687076"
          value={searchQuery}
          onChangeText={handleSearch}
          className="flex-1 ml-2 text-foreground"
        />
      </View>

      {cartItems.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <MaterialIcons name="shopping-cart" size={48} color="#687076" />
          <Text className="text-lg font-semibold text-foreground mt-4 text-center">
            Cart is Empty
          </Text>
          <Text className="text-sm text-muted text-center mt-2">
            Tap on products to add them to your cart
          </Text>
        </View>
      ) : null}

      <FlatList
        data={filteredProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 300 }}
        scrollEnabled={true}
      />

      {/* Cart Footer */}
      {cartItems.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border p-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-foreground">
              Total: {settings.currency}{total.toFixed(2)}
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => clearCart()}
                className="bg-error/20 px-4 py-2 rounded-lg"
              >
                <Text className="text-error font-semibold">Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCheckout}
                disabled={processing}
                className="bg-primary px-6 py-2 rounded-lg flex-row items-center"
              >
                {processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={20} color="#fff" />
                    <Text className="text-white font-bold ml-2">Checkout</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Discount Input */}
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-muted">Discount (%):</Text>
            <TextInput
              placeholder="0"
              placeholderTextColor="#687076"
              value={discount.toString()}
              onChangeText={(text) => setDiscount(parseFloat(text) || 0)}
              className="flex-1 bg-background border border-border rounded-lg px-2 py-1 text-foreground"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
