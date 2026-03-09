import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { addProduct, getProduct, updateProduct, Product } from '@/lib/database';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '@/lib/store';

export default function ProductFormScreen() {
  const router = useRouter();
  const { productId, barcode } = useLocalSearchParams<{ productId?: string; barcode?: string }>();
  const { settings } = useAppStore();
  const [loading, setLoading] = useState(!!productId);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    barcode: barcode || '',
    name: '',
    costPrice: '',
    sellingPrice: '',
    quantity: '',
    reorderLevel: '5',
    unit: 'pieces',
    category: '',
  });

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    try {
      const product = await getProduct(productId!);
      if (product) {
        setForm({
          barcode: product.barcode,
          name: product.name,
          costPrice: product.costPrice.toString(),
          sellingPrice: product.sellingPrice.toString(),
          quantity: product.quantity.toString(),
          reorderLevel: product.reorderLevel.toString(),
          unit: product.unit,
          category: product.category || '',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!form.barcode.trim()) {
      Alert.alert('Validation Error', 'Please enter or scan a barcode');
      return false;
    }
    if (!form.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a product name');
      return false;
    }
    if (!form.costPrice || isNaN(parseFloat(form.costPrice))) {
      Alert.alert('Validation Error', 'Please enter a valid cost price');
      return false;
    }
    if (!form.sellingPrice || isNaN(parseFloat(form.sellingPrice))) {
      Alert.alert('Validation Error', 'Please enter a valid selling price');
      return false;
    }
    if (form.quantity === '' || isNaN(parseInt(form.quantity))) {
      Alert.alert('Validation Error', 'Please enter a valid quantity');
      return false;
    }
    if (form.reorderLevel === '' || isNaN(parseInt(form.reorderLevel))) {
      Alert.alert('Validation Error', 'Please enter a valid reorder level');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const productData = {
        barcode: form.barcode.trim(),
        name: form.name.trim(),
        costPrice: parseFloat(form.costPrice),
        sellingPrice: parseFloat(form.sellingPrice),
        quantity: parseInt(form.quantity),
        reorderLevel: parseInt(form.reorderLevel),
        unit: form.unit,
        category: form.category.trim() || undefined,
      };

      if (productId) {
        await updateProduct(productId, productData);
        Alert.alert('Success', 'Product updated successfully');
      } else {
        await addProduct(productData);
        Alert.alert('Success', 'Product added successfully');
      }

      router.back();
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        Alert.alert('Error', 'A product with this barcode already exists');
      } else {
        Alert.alert('Error', 'Failed to save product');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  const profit = form.costPrice && form.sellingPrice
    ? (parseFloat(form.sellingPrice) - parseFloat(form.costPrice)).toFixed(2)
    : '0.00';

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4 pt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-3xl font-bold text-foreground">
            {productId ? 'Edit Product' : 'Add Product'}
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="close" size={28} color="#11181C" />
          </TouchableOpacity>
        </View>

        {/* Barcode */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">Barcode *</Text>
          <View className="flex-row items-center bg-surface border border-border rounded-lg px-3">
            <TextInput
              placeholder="Enter or scan barcode"
              placeholderTextColor="#687076"
              value={form.barcode}
              onChangeText={(text) => setForm({ ...form, barcode: text })}
              className="flex-1 py-3 text-foreground"
              editable={!productId}
            />
            <TouchableOpacity onPress={() => router.push('/barcode-scanner')} className="p-2">
              <MaterialIcons name="qr-code-scanner" size={24} color="#0a7ea4" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Product Name */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">Product Name *</Text>
          <TextInput
            placeholder="Enter product name"
            placeholderTextColor="#687076"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            className="bg-surface border border-border rounded-lg px-3 py-3 text-foreground"
          />
        </View>

        {/* Category */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">Category</Text>
          <TextInput
            placeholder="e.g., Vegetables, Dairy, Meat"
            placeholderTextColor="#687076"
            value={form.category}
            onChangeText={(text) => setForm({ ...form, category: text })}
            className="bg-surface border border-border rounded-lg px-3 py-3 text-foreground"
          />
        </View>

        {/* Cost Price and Selling Price */}
        <View className="flex-row gap-4 mb-4">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground mb-2">Cost Price *</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-lg px-3">
              <Text className="text-foreground font-semibold">{settings.currency}</Text>
              <TextInput
                placeholder="0.00"
                placeholderTextColor="#687076"
                value={form.costPrice}
                onChangeText={(text) => setForm({ ...form, costPrice: text })}
                className="flex-1 py-3 text-foreground ml-2"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground mb-2">Selling Price *</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-lg px-3">
              <Text className="text-foreground font-semibold">{settings.currency}</Text>
              <TextInput
                placeholder="0.00"
                placeholderTextColor="#687076"
                value={form.sellingPrice}
                onChangeText={(text) => setForm({ ...form, sellingPrice: text })}
                className="flex-1 py-3 text-foreground ml-2"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Profit per unit */}
        <View className="bg-success/10 border border-success rounded-lg p-3 mb-4">
          <Text className="text-xs text-muted">Profit per Unit</Text>
          <Text className="text-xl font-bold text-success">
            {settings.currency}{profit}
          </Text>
        </View>

        {/* Quantity and Reorder Level */}
        <View className="flex-row gap-4 mb-4">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground mb-2">Quantity *</Text>
            <TextInput
              placeholder="0"
              placeholderTextColor="#687076"
              value={form.quantity}
              onChangeText={(text) => setForm({ ...form, quantity: text })}
              className="bg-surface border border-border rounded-lg px-3 py-3 text-foreground"
              keyboardType="number-pad"
            />
          </View>

          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground mb-2">Reorder Level *</Text>
            <TextInput
              placeholder="5"
              placeholderTextColor="#687076"
              value={form.reorderLevel}
              onChangeText={(text) => setForm({ ...form, reorderLevel: text })}
              className="bg-surface border border-border rounded-lg px-3 py-3 text-foreground"
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Unit */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-foreground mb-2">Unit</Text>
          <View className="flex-row gap-2">
            {['pieces', 'kg', 'liters', 'boxes'].map((unit) => (
              <TouchableOpacity
                key={unit}
                onPress={() => setForm({ ...form, unit })}
                className={`flex-1 py-2 px-3 rounded-lg border ${
                  form.unit === unit
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-border'
                }`}
              >
                <Text
                  className={`text-center font-semibold text-sm ${
                    form.unit === unit ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-primary rounded-lg py-4 mb-4 flex-row items-center justify-center"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="check" size={24} color="#fff" />
              <Text className="text-white font-semibold ml-2">
                {productId ? 'Update Product' : 'Add Product'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface border border-border rounded-lg py-4 flex-row items-center justify-center"
        >
          <Text className="text-foreground font-semibold">Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
