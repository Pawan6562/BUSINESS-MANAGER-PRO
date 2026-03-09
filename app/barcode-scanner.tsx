import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { getProductByBarcode } from '@/lib/database';

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;

    setScanned(true);
    setLoading(true);

    try {
      // Check if product exists
      const product = await getProductByBarcode(data);

      if (product) {
        // Product found, return with product data
        router.back();
        // Send data back through navigation params
        router.setParams({ scannedBarcode: data, productId: product.id });
      } else {
        // Product not found, ask user if they want to create it
        Alert.alert(
          'Product Not Found',
          `Barcode: ${data}\n\nDo you want to create a new product with this barcode?`,
          [
            {
              text: 'Cancel',
              onPress: () => {
                setScanned(false);
                setLoading(false);
              },
            },
            {
              text: 'Create',
              onPress: () => {
                router.push({
                  pathname: '/product-form',
                  params: { barcode: data },
                });
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process barcode');
      setScanned(false);
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer className="flex items-center justify-center px-4">
        <MaterialIcons name="camera-alt" size={48} color="#687076" />
        <Text className="text-lg font-semibold text-foreground mt-4 text-center">
          Camera Access Required
        </Text>
        <Text className="text-sm text-muted text-center mt-2 mb-6">
          We need camera permission to scan barcodes
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-primary px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
            'qr',
          ],
        }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-semibold">Scan Barcode</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Scanning overlay */}
        <View className="flex-1 items-center justify-center">
          <View className="w-64 h-64 border-2 border-white rounded-lg" />
          <Text className="text-white text-center mt-8 text-lg font-semibold">
            {loading ? 'Processing...' : 'Point camera at barcode'}
          </Text>
        </View>

        {/* Footer */}
        <View className="px-4 py-6 bg-black/50">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-white/20 rounded-lg py-3 flex-row items-center justify-center"
          >
            <MaterialIcons name="close" size={24} color="#fff" />
            <Text className="text-white font-semibold ml-2">Close Scanner</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}
