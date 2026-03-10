import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { getAllProducts, addSale, Product, Sale, SaleItem } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CartItem extends SaleItem {
  availableStock: number;
}

export default function SalesScreen() {
  const router = useRouter();
  const { settings } = useAppStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(settings.taxPercentage || 0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [recentItems, setRecentItems] = useState<Product[]>([]);

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

  // Search products by name or barcode
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  };

  // Barcode scanning
  const handleBarcodeScan = async (barcode: string) => {
    const product = products.find((p) => p.barcode === barcode.trim());

    if (!product) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Product Not Found', `No product found with barcode: ${barcode}`);
      setBarcodeInput('');
      return;
    }

    // Check if product already in cart
    const existingItem = cart.find((item) => item.productId === product.id);

    if (existingItem) {
      // Check if we can increase quantity
      if (existingItem.quantity < product.quantity) {
        updateCartItemQuantity(product.id, existingItem.quantity + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Stock Limit', `Only ${product.quantity} units available in stock`);
      }
    } else {
      // Add new item to cart
      addToCart(product);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Add to recent items
    setRecentItems((prev) => {
      const filtered = prev.filter((p) => p.id !== product.id);
      return [product, ...filtered].slice(0, 5);
    });

    setBarcodeInput('');
  };

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      Alert.alert('Out of Stock', `${product.name} is not available`);
      return;
    }

    const newItem: CartItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.sellingPrice,
      subtotal: product.sellingPrice,
      availableStock: product.quantity,
    };

    setCart([...cart, newItem]);
  };

  // Update cart item quantity
  const updateCartItemQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Check stock availability
    if (newQuantity > product.quantity) {
      Alert.alert('Stock Limit', `Only ${product.quantity} units available`);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: newQuantity,
              subtotal: item.unitPrice * newQuantity,
              availableStock: product.quantity,
            }
          : item
      )
    );
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = (subtotal * discount) / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * taxRate) / 100;
    const total = taxableAmount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      total,
    };
  };

  // Process checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items before checkout');
      return;
    }

    try {
      const { subtotal, discountAmount, taxAmount, total } = calculateTotals();

      const sale: Sale = {
        id: `sale_${Date.now()}`,
        items: cart,
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        paymentMethod,
        createdAt: Date.now(),
      };

      await addSale(sale);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Sale Completed', `Total: ${settings.currency}${total.toFixed(2)}`, [
        {
          text: 'View Receipt',
          onPress: () => router.push('/sales-history'),
        },
        {
          text: 'New Sale',
          onPress: () => {
            setCart([]);
            setDiscount(0);
            setShowCheckout(false);
          },
        },
      ]);

      setCart([]);
      setDiscount(0);
      setShowCheckout(false);
    } catch (error) {
      console.error('Error processing sale:', error);
      Alert.alert('Error', 'Failed to process sale');
    }
  };

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals();

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1 bg-background">
      <View className="flex-1 flex-row">
        {/* Left: Product Selection */}
        <View className="flex-1">
          <View className="px-4 pt-4 pb-2">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-2xl font-bold text-foreground">Sales</Text>
              <TouchableOpacity
                onPress={() => setShowBarcodeModal(true)}
                className="bg-primary rounded-lg px-3 py-2"
              >
                <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-2 mb-4">
              <MaterialIcons name="search" size={20} color="#687076" />
              <TextInput
                placeholder="Search products..."
                placeholderTextColor="#9BA1A6"
                value={searchQuery}
                onChangeText={handleSearch}
                className="flex-1 ml-2 text-foreground"
              />
            </View>

            {/* Recent Items */}
            {recentItems.length > 0 && (
              <View className="mb-4">
                <Text className="text-sm font-semibold text-muted mb-2">Recent Items</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                  {recentItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => addToCart(item)}
                      className="bg-primary/10 border border-primary rounded-lg px-3 py-2 min-w-max"
                    >
                      <Text className="text-primary font-semibold text-xs">{item.name}</Text>
                      <Text className="text-primary text-xs">
                        {settings.currency}{item.sellingPrice.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Products List */}
          <FlatList
            data={filteredProducts}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => addToCart(item)}
                disabled={item.quantity <= 0}
                className={`mx-4 mb-3 p-4 rounded-lg border ${
                  item.quantity <= 0
                    ? 'bg-surface/50 border-border opacity-50'
                    : 'bg-surface border-border'
                }`}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
                    <Text className="text-sm text-muted">
                      {settings.currency}{item.sellingPrice.toFixed(2)}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <MaterialIcons
                        name={
                          item.quantity <= 0
                            ? 'cancel'
                            : item.quantity <= item.reorderLevel
                            ? 'warning'
                            : 'check-circle'
                        }
                        size={16}
                        color={
                          item.quantity <= 0
                            ? '#EF4444'
                            : item.quantity <= item.reorderLevel
                            ? '#F59E0B'
                            : '#22C55E'
                        }
                      />
                      <Text className="text-xs text-muted ml-1">
                        Stock: {item.quantity} {item.unit}
                      </Text>
                    </View>
                  </View>
                  {item.quantity > 0 && (
                    <TouchableOpacity
                      onPress={() => addToCart(item)}
                      className="bg-primary rounded-lg p-2"
                    >
                      <MaterialIcons name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>

        {/* Right: Cart Summary */}
        <View className="w-80 bg-surface border-l border-border flex-col">
          <View className="px-4 pt-4 pb-2">
            <Text className="text-2xl font-bold text-foreground">Cart</Text>
            <Text className="text-sm text-muted">
              {cart.length} item{cart.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Cart Items */}
          <ScrollView className="flex-1 px-4">
            {cart.length === 0 ? (
              <View className="flex-1 items-center justify-center py-8">
                <MaterialIcons name="shopping-cart" size={48} color="#687076" />
                <Text className="text-muted text-center mt-4">Cart is empty</Text>
              </View>
            ) : (
              cart.map((item) => (
                <View
                  key={item.productId}
                  className="bg-background border border-border rounded-lg p-3 mb-3"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <Text className="font-semibold text-foreground flex-1">{item.productName}</Text>
                    <TouchableOpacity onPress={() => removeFromCart(item.productId)}>
                      <MaterialIcons name="close" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <Text className="text-sm text-muted mb-2">
                    {settings.currency}{item.unitPrice.toFixed(2)} x {item.quantity} ={' '}
                    {settings.currency}{item.subtotal.toFixed(2)}
                  </Text>

                  {/* Quantity Controls */}
                  <View className="flex-row items-center justify-between">
                    <TouchableOpacity
                      onPress={() => updateCartItemQuantity(item.productId, item.quantity - 1)}
                      className="bg-error/10 rounded-lg px-3 py-1"
                    >
                      <Text className="text-error font-bold">−</Text>
                    </TouchableOpacity>

                    <Text className="text-foreground font-semibold">{item.quantity}</Text>

                    <TouchableOpacity
                      onPress={() => updateCartItemQuantity(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.availableStock}
                      className={`rounded-lg px-3 py-1 ${
                        item.quantity >= item.availableStock
                          ? 'bg-muted/20'
                          : 'bg-success/10'
                      }`}
                    >
                      <Text className={item.quantity >= item.availableStock ? 'text-muted' : 'text-success font-bold'}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {item.quantity >= item.availableStock && (
                    <Text className="text-xs text-warning mt-1">Max stock reached</Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>

          {/* Totals and Checkout */}
          {cart.length > 0 && (
            <View className="px-4 py-4 border-t border-border">
              <View className="space-y-2 mb-4">
                <View className="flex-row justify-between">
                  <Text className="text-muted">Subtotal</Text>
                  <Text className="font-semibold text-foreground">
                    {settings.currency}{subtotal.toFixed(2)}
                  </Text>
                </View>

                {discount > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-muted">Discount ({discount}%)</Text>
                    <Text className="font-semibold text-success">
                      -{settings.currency}{discountAmount.toFixed(2)}
                    </Text>
                  </View>
                )}

                {taxRate > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-muted">Tax ({taxRate}%)</Text>
                    <Text className="font-semibold text-foreground">
                      {settings.currency}{taxAmount.toFixed(2)}
                    </Text>
                  </View>
                )}

                <View className="flex-row justify-between border-t border-border pt-2 mt-2">
                  <Text className="text-lg font-bold text-foreground">Total</Text>
                  <Text className="text-2xl font-bold text-primary">
                    {settings.currency}{total.toFixed(2)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setShowCheckout(true)}
                className="bg-primary rounded-lg py-4 flex-row items-center justify-center"
              >
                <MaterialIcons name="check-circle" size={24} color="#fff" />
                <Text className="text-white font-bold ml-2">Checkout</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCart([])}
                className="bg-error/10 rounded-lg py-3 mt-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="delete" size={20} color="#EF4444" />
                <Text className="text-error font-semibold ml-2">Clear Cart</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Barcode Scanner Modal */}
      <Modal visible={showBarcodeModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-2xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-foreground">Scan Barcode</Text>
              <TouchableOpacity onPress={() => setShowBarcodeModal(false)}>
                <MaterialIcons name="close" size={28} color="#11181C" />
              </TouchableOpacity>
            </View>

            <TextInput
              autoFocus
              placeholder="Enter or scan barcode..."
              placeholderTextColor="#9BA1A6"
              value={barcodeInput}
              onChangeText={setBarcodeInput}
              onSubmitEditing={() => handleBarcodeScan(barcodeInput)}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground mb-4"
              returnKeyType="done"
            />

            <TouchableOpacity
              onPress={() => handleBarcodeScan(barcodeInput)}
              className="bg-primary rounded-lg py-4 flex-row items-center justify-center"
            >
              <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
              <Text className="text-white font-bold ml-2">Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Checkout Modal */}
      <Modal visible={showCheckout} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-surface rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-2xl font-bold text-foreground mb-4">Complete Sale</Text>

            <View className="bg-background rounded-lg p-4 mb-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-muted">Subtotal</Text>
                <Text className="font-semibold text-foreground">
                  {settings.currency}{subtotal.toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-muted">Total</Text>
                <Text className="text-2xl font-bold text-primary">
                  {settings.currency}{total.toFixed(2)}
                </Text>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-2">Payment Method</Text>
              <View className="flex-row gap-2">
                {['cash', 'card', 'upi'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    className={`flex-1 py-2 px-3 rounded-lg border ${
                      paymentMethod === method
                        ? 'bg-primary border-primary'
                        : 'bg-surface border-border'
                    }`}
                  >
                    <Text
                      className={`text-center font-semibold text-sm capitalize ${
                        paymentMethod === method ? 'text-white' : 'text-foreground'
                      }`}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={handleCheckout}
              className="bg-primary rounded-lg py-4 mb-2 flex-row items-center justify-center"
            >
              <MaterialIcons name="check" size={24} color="#fff" />
              <Text className="text-white font-bold ml-2">Complete Sale</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowCheckout(false)}
              className="bg-surface border border-border rounded-lg py-3 flex-row items-center justify-center"
            >
              <Text className="text-foreground font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
