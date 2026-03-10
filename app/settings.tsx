import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useAppStore();
  const [loading, setLoading] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState(settings.businessName || '');
  const [currency, setCurrency] = useState(settings.currency || '$');
  const [taxPercentage, setTaxPercentage] = useState(settings.taxPercentage?.toString() || '0');
  const [lowStockThreshold, setLowStockThreshold] = useState(settings.lowStockThreshold?.toString() || '5');
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled !== false);

  const handleSaveSettings = async () => {
    try {
      setLoading(true);

      // Validation
      if (!businessName.trim()) {
        Alert.alert('Validation Error', 'Business name is required');
        return;
      }

      const tax = parseFloat(taxPercentage) || 0;
      const threshold = parseInt(lowStockThreshold) || 5;

      if (tax < 0 || tax > 100) {
        Alert.alert('Validation Error', 'Tax percentage must be between 0 and 100');
        return;
      }

      if (threshold < 1) {
        Alert.alert('Validation Error', 'Low stock threshold must be at least 1');
        return;
      }

      // Update settings
      await updateSettings({
        businessName: businessName.trim(),
        currency: currency.trim() || '$',
        taxPercentage: tax,
        lowStockThreshold: threshold,
        notificationsEnabled,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-4 pb-6 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <MaterialIcons name="arrow-back" size={28} color="#0a7ea4" />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Settings</Text>
        </View>

        {/* Business Information Section */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">Business Information</Text>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Business Name</Text>
            <TextInput
              placeholder="Enter your business name"
              placeholderTextColor="#9BA1A6"
              value={businessName}
              onChangeText={setBusinessName}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
            />
            <Text className="text-xs text-muted mt-1">This name appears in receipts and reports</Text>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Currency Symbol</Text>
            <View className="flex-row gap-2">
              {['$', '€', '£', '₹', '¥', '₽'].map((sym) => (
                <TouchableOpacity
                  key={sym}
                  onPress={() => setCurrency(sym)}
                  className={`flex-1 py-3 px-2 rounded-lg border ${
                    currency === sym ? 'bg-primary border-primary' : 'bg-surface border-border'
                  }`}
                >
                  <Text
                    className={`text-center font-bold text-lg ${
                      currency === sym ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {sym}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-xs text-muted mt-2">Selected: {currency}</Text>
          </View>
        </View>

        {/* Financial Settings Section */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">Financial Settings</Text>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Tax Percentage (%)</Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                placeholder="0"
                placeholderTextColor="#9BA1A6"
                value={taxPercentage}
                onChangeText={setTaxPercentage}
                keyboardType="decimal-pad"
                className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              />
              <Text className="text-foreground font-semibold">%</Text>
            </View>
            <Text className="text-xs text-muted mt-1">Applied to all sales automatically</Text>
          </View>

          <View className="bg-surface border border-border rounded-lg p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-semibold text-foreground">Example Calculation</Text>
                <Text className="text-xs text-muted mt-1">Sale: $100 + Tax ({taxPercentage}%) = ${(100 + (100 * parseFloat(taxPercentage) / 100)).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Inventory Settings Section */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">Inventory Settings</Text>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Low Stock Threshold</Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                placeholder="5"
                placeholderTextColor="#9BA1A6"
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
                keyboardType="number-pad"
                className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              />
              <Text className="text-foreground font-semibold">units</Text>
            </View>
            <Text className="text-xs text-muted mt-1">Products below this quantity show low-stock warning</Text>
          </View>

          <View className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <View className="flex-row items-start gap-2">
              <MaterialIcons name="info" size={20} color="#F59E0B" />
              <View className="flex-1">
                <Text className="font-semibold text-warning">Low Stock Alert</Text>
                <Text className="text-xs text-warning/80 mt-1">
                  When product quantity drops to {lowStockThreshold} or below, you'll receive a notification
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">Notifications</Text>

          <View className="bg-surface border border-border rounded-lg p-4 flex-row items-center justify-between">
            <View>
              <Text className="font-semibold text-foreground">Enable Notifications</Text>
              <Text className="text-xs text-muted mt-1">Receive alerts for low stock items</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#687076', true: '#0a7ea4' }}
            />
          </View>
        </View>

        {/* Data Management Section */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">Data Management</Text>

          <TouchableOpacity className="bg-surface border border-border rounded-lg p-4 flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-3">
              <MaterialIcons name="backup" size={24} color="#0a7ea4" />
              <View>
                <Text className="font-semibold text-foreground">Backup Data</Text>
                <Text className="text-xs text-muted">Export all data to file</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#687076" />
          </TouchableOpacity>

          <TouchableOpacity className="bg-surface border border-border rounded-lg p-4 flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-3">
              <MaterialIcons name="restore" size={24} color="#0a7ea4" />
              <View>
                <Text className="font-semibold text-foreground">Restore Data</Text>
                <Text className="text-xs text-muted">Import data from backup</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#687076" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Clear All Data',
                'This will delete all products, sales, and expenses. This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      // TODO: Implement clear data functionality
                      Alert.alert('Info', 'Clear data feature coming soon');
                    },
                  },
                ]
              );
            }}
            className="bg-error/10 border border-error/30 rounded-lg p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <MaterialIcons name="delete-sweep" size={24} color="#EF4444" />
              <View>
                <Text className="font-semibold text-error">Clear All Data</Text>
                <Text className="text-xs text-error/80">Delete everything (irreversible)</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View className="px-4 mb-8">
          <Text className="text-lg font-bold text-foreground mb-4">About</Text>

          <View className="bg-surface border border-border rounded-lg p-4">
            <View className="mb-3">
              <Text className="text-sm text-muted">App Name</Text>
              <Text className="font-semibold text-foreground mt-1">Grocery Manager Pro</Text>
            </View>
            <View className="mb-3">
              <Text className="text-sm text-muted">Version</Text>
              <Text className="font-semibold text-foreground mt-1">1.0.0</Text>
            </View>
            <View>
              <Text className="text-sm text-muted">Offline First</Text>
              <Text className="font-semibold text-foreground mt-1">All data stored locally on device</Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <View className="px-4 pb-6">
          <TouchableOpacity
            onPress={handleSaveSettings}
            disabled={loading}
            className="bg-primary rounded-lg py-4 flex-row items-center justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="save" size={24} color="#fff" />
                <Text className="text-white font-bold ml-2 text-lg">Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
