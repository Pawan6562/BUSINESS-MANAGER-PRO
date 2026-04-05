import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Dimensions,
  Share,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { getAllProducts, addSale, Product, Sale, SaleItem } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useColors } from '@/hooks/use-colors';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { generateBillText } from '@/lib/bill-generator';
import { BillPreviewModal } from '@/components/BillPreviewModal';

interface CartItem extends SaleItem {
  availableStock: number;
}

export default function SalesScreen() {
  const router = useRouter();
  const colors = useColors();
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
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [scannedBarcodes, setScannedBarcodes] = useState<Set<string>>(new Set());
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

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

  // Request camera permission
  const handleCameraPermission = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Camera permission is required to scan barcodes');
        return;
      }
    }
    setShowCamera(true);
  };

  // Handle barcode scan
  const handleBarcodeScanned = (result: any) => {
    const barcode = result.data;

    // Prevent duplicate scans within 1 second
    if (scannedBarcodes.has(barcode)) {
      return;
    }

    setScannedBarcodes((prev) => {
      const updated = new Set(prev);
      updated.add(barcode);
      setTimeout(() => {
        setScannedBarcodes((current) => {
          const next = new Set(current);
          next.delete(barcode);
          return next;
        });
      }, 1000);
      return updated;
    });

    const product = products.find((p) => p.barcode === barcode.trim());

    if (!product) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Product Not Found', `No product found with barcode: ${barcode}`);
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

    setShowCamera(false);
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

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      Alert.alert('Out of Stock', `${product.name} is not available`);
      return;
    }

    const existingItem = cart.find((item) => item.productId === product.id);

    if (existingItem) {
      if (existingItem.quantity < product.quantity) {
        updateCartItemQuantity(product.id, existingItem.quantity + 1);
      } else {
        Alert.alert('Stock Limit', `Only ${product.quantity} units available`);
      }
    } else {
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.sellingPrice,
        subtotal: product.sellingPrice,
        availableStock: product.quantity,
      };
      setCart([...cart, newItem]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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

  // Apply quick discount
  const applyQuickDiscount = (discountPercent: number) => {
    setDiscount(discountPercent);
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
      setLastSale(sale);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Sale Completed', `Total: ${settings.currency}${total.toFixed(2)}`, [
        {
          text: 'New Sale',
          onPress: () => {
            setCart([]);
            setDiscount(0);
            setShowCheckout(false);
          },
        },
        {
          text: 'Send Bill',
          onPress: () => {
            setShowCheckout(false);
            setShowBillPreview(true);
          },
        },
        {
          text: 'View Receipt',
          onPress: () => router.push('/sales-history'),
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
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-4 pb-3 flex-row items-center justify-between">
          <Text className="text-3xl font-bold text-foreground">Sales</Text>
          <TouchableOpacity
            onPress={handleCameraPermission}
            className="bg-primary rounded-lg px-4 py-3 flex-row items-center gap-2"
          >
            <MaterialIcons name="qr-code-scanner" size={20} color="#fff" />
            <Text className="text-white font-semibold">Scan</Text>
          </TouchableOpacity>
        </View>

        {/* ========== CART SECTION AT TOP ========== */}
        <View className="px-4 pb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-foreground">
              Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})
            </Text>
            {cart.length > 0 && (
              <TouchableOpacity onPress={() => setCart([])}>
                <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          {cart.length === 0 ? (
            <View className="bg-surface border border-border rounded-lg p-6 items-center">
              <MaterialIcons name="shopping-cart" size={40} color="#687076" />
              <Text className="text-muted text-center mt-2">Cart is empty. Add items to get started.</Text>
            </View>
          ) : (
            <>
              {cart.map((item) => (
                <View
                  key={item.productId}
                  className="bg-surface border border-border rounded-lg p-4 mb-3"
                >
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground text-base">{item.productName}</Text>
                      <Text className="text-sm text-muted mt-1">
                        {settings.currency}{item.unitPrice.toFixed(2)} × {item.quantity}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeFromCart(item.productId)}>
                      <MaterialIcons name="close" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  {/* Quantity Controls */}
                  <View className="flex-row items-center justify-between mb-3">
                    <TouchableOpacity
                      onPress={() => updateCartItemQuantity(item.productId, item.quantity - 1)}
                      className="bg-error/10 rounded-lg px-4 py-2"
                    >
                      <Text className="text-error font-bold text-lg">−</Text>
                    </TouchableOpacity>

                    <Text className="text-foreground font-bold text-lg">{item.quantity}</Text>

                    <TouchableOpacity
                      onPress={() => updateCartItemQuantity(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.availableStock}
                      className={`rounded-lg px-4 py-2 ${
                        item.quantity >= item.availableStock ? 'bg-muted/20' : 'bg-success/10'
                      }`}
                    >
                      <Text
                        className={`font-bold text-lg ${
                          item.quantity >= item.availableStock ? 'text-muted' : 'text-success'
                        }`}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Item Total */}
                  <View className="flex-row justify-between items-center border-t border-border pt-2">
                    <Text className="text-muted text-sm">Item Total</Text>
                    <Text className="font-bold text-primary text-base">
                      {settings.currency}{item.subtotal.toFixed(2)}
                    </Text>
                  </View>

                  {item.quantity >= item.availableStock && (
                    <Text className="text-xs text-warning mt-2">⚠ Max stock reached</Text>
                  )}
                </View>
              ))}

              {/* Totals */}
              <View className="bg-background border border-border rounded-lg p-4 mb-3">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-muted">Subtotal</Text>
                  <Text className="font-semibold text-foreground">
                    {settings.currency}{subtotal.toFixed(2)}
                  </Text>
                </View>

                {discount > 0 && (
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-muted">Discount ({discount}%)</Text>
                    <Text className="font-semibold text-success">
                      -{settings.currency}{discountAmount.toFixed(2)}
                    </Text>
                  </View>
                )}

                {taxRate > 0 && (
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-muted">Tax ({taxRate}%)</Text>
                    <Text className="font-semibold text-foreground">
                      {settings.currency}{taxAmount.toFixed(2)}
                    </Text>
                  </View>
                )}

                <View className="flex-row justify-between border-t border-border pt-3 mt-3">
                  <Text className="text-lg font-bold text-foreground">Total</Text>
                  <Text className="text-2xl font-bold text-primary">
                    {settings.currency}{total.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Quick Discount Buttons */}
              <View className="mb-3">
                <Text className="text-sm font-semibold text-foreground mb-2">Quick Discount</Text>
                <View className="flex-row gap-2 flex-wrap">
                  {[5, 10, 15, 20].map((discountPercent) => (
                    <TouchableOpacity
                      key={discountPercent}
                      onPress={() => applyQuickDiscount(discountPercent)}
                      className={`flex-1 py-2 px-3 rounded-lg border ${
                        discount === discountPercent
                          ? 'bg-primary border-primary'
                          : 'bg-surface border-border'
                      }`}
                    >
                      <Text
                        className={`text-center font-bold text-sm ${
                          discount === discountPercent ? 'text-white' : 'text-foreground'
                        }`}
                      >
                        {discountPercent}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Checkout Button */}
              <TouchableOpacity
                onPress={() => setShowCheckout(true)}
                className="bg-primary rounded-lg py-4 flex-row items-center justify-center mb-3"
              >
                <MaterialIcons name="check-circle" size={24} color="#fff" />
                <Text className="text-white font-bold ml-2 text-lg">Checkout</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Divider */}
        <View className="h-1 bg-border mx-4 mb-4" />

        {/* ========== PRODUCTS SECTION BELOW ========== */}
        <View className="px-4 pb-4">
          {/* Search Bar */}
          <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-3 mb-4">
            <MaterialIcons name="search" size={20} color="#687076" />
            <TextInput
              placeholder="Search products..."
              placeholderTextColor="#9BA1A6"
              value={searchQuery}
              onChangeText={handleSearch}
              className="flex-1 ml-2 text-foreground"
            />
          </View>

          <Text className="text-sm font-semibold text-muted mb-3">Available Products</Text>
          {filteredProducts.length === 0 ? (
            <View className="items-center py-8">
              <MaterialIcons name="inbox" size={48} color="#687076" />
              <Text className="text-muted text-center mt-2">No products found</Text>
            </View>
          ) : (
            filteredProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                onPress={() => addToCart(product)}
                disabled={product.quantity <= 0}
                className="bg-surface border border-border rounded-lg p-3 mb-3 flex-row items-center"
              >
                {product.imageUri ? (
                  <Image
                    source={{ uri: product.imageUri }}
                    style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }}
                  />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <MaterialIcons name="inventory-2" size={24} color={colors.muted} />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">{product.name}</Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    <Text className="text-sm font-bold text-primary">
                      {settings.currency}{product.sellingPrice.toFixed(2)}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <MaterialIcons
                        name={
                          product.quantity <= 0
                            ? 'cancel'
                            : product.quantity <= product.reorderLevel
                            ? 'warning'
                            : 'check-circle'
                        }
                        size={14}
                        color={
                          product.quantity <= 0
                            ? '#EF4444'
                            : product.quantity <= product.reorderLevel
                            ? '#F59E0B'
                            : '#22C55E'
                        }
                      />
                      <Text className="text-xs text-muted">
                        {product.quantity} {product.unit}
                      </Text>
                    </View>
                  </View>
                </View>
                {product.quantity > 0 && (
                  <TouchableOpacity
                    onPress={() => addToCart(product)}
                    className="bg-primary rounded-lg p-3 ml-3"
                  >
                    <MaterialIcons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Camera Modal */}
      <Modal visible={showCamera} animationType="slide">
        <View className="flex-1 bg-black">
          {permission?.granted ? (
            <>
              <CameraView
                ref={cameraRef}
                style={{ flex: 1 }}
                onBarcodeScanned={(result) => handleBarcodeScanned(result)}
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a'] as any,
                }}
              />
              <View className="absolute top-0 left-0 right-0 bg-black/50 px-4 py-6 flex-row items-center justify-between">
                <TouchableOpacity onPress={() => setShowCamera(false)}>
                  <MaterialIcons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text className="text-white font-bold text-lg">Scan Barcode</Text>
                <View style={{ width: 28 }} />
              </View>
            </>
          ) : (
            <View className="flex-1 items-center justify-center bg-black">
              <MaterialIcons name="camera-alt" size={64} color="#fff" />
              <Text className="text-white text-lg mt-4">Camera permission required</Text>
              <TouchableOpacity
                onPress={() => setShowCamera(false)}
                className="mt-6 bg-primary px-6 py-3 rounded-lg"
              >
                <Text className="text-white font-bold">Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Bill Preview Modal */}
      {lastSale && (
        <BillPreviewModal
          visible={showBillPreview}
          billText={generateBillText(lastSale, settings.businessName, settings.currency)}
          businessName={settings.businessName}
          onClose={() => setShowBillPreview(false)}
          onShare={async () => {
            try {
              await Share.share({
                message: generateBillText(lastSale, settings.businessName, settings.currency),
                title: `Bill from ${settings.businessName}`,
              });
              setShowBillPreview(false);
            } catch (error) {
              Alert.alert('Error', 'Failed to share bill');
            }
          }}
        />
      )}

      {/* Checkout Modal */}
      <Modal visible={showCheckout} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-surface rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-2xl font-bold text-foreground mb-4">Complete Sale</Text>

            <View className="bg-background rounded-lg p-4 mb-4">
              <View className="flex-row justify-between mb-3">
                <Text className="text-muted">Subtotal</Text>
                <Text className="font-semibold text-foreground">
                  {settings.currency}{subtotal.toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-3">
                <Text className="text-muted">Total</Text>
                <Text className="text-2xl font-bold text-primary">
                  {settings.currency}{total.toFixed(2)}
                </Text>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-3">Payment Method</Text>
              <View className="flex-row gap-2">
                {['cash', 'card', 'upi'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    className={`flex-1 py-3 px-3 rounded-lg border ${
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
