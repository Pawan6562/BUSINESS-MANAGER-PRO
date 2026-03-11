import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';
import {
  createBackup,
  shareBackup,
  getBackupFiles,
  deleteBackupFile,
  readBackupFile,
  formatBackupFileInfo,
} from '@/lib/data-management';
import { clearAllData } from '@/lib/database';

type SettingsTab = 'general' | 'data' | 'backups' | 'advanced' | 'about';

export default function SettingsAdvanced() {
  const router = useRouter();
  const colors = useColors();
  const { settings, updateSettings } = useAppStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [loading, setLoading] = useState(false);
  const [backupFiles, setBackupFiles] = useState<string[]>([]);
  const [backupInfo, setBackupInfo] = useState<Record<string, any>>({});

  // General settings state
  const [businessName, setBusinessName] = useState(settings.businessName || '');
  const [currency, setCurrency] = useState(settings.currency || '₹');
  const [taxRate, setTaxRate] = useState(settings.taxPercentage?.toString() || '0');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    settings.lowStockThreshold?.toString() || '5'
  );

  // Advanced settings state
  const [enableNotifications, setEnableNotifications] = useState(settings.notificationsEnabled !== false);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    if (activeTab === 'backups') {
      loadBackupFiles();
    }
  }, [activeTab]);

  const loadBackupFiles = async () => {
    try {
      setLoading(true);
      const files = await getBackupFiles();
      setBackupFiles(files);

      // Load info for each file
      const info: Record<string, any> = {};
      for (const file of files) {
        info[file] = await formatBackupFileInfo(file);
      }
      setBackupInfo(info);
    } catch (error) {
      Alert.alert('Error', 'Failed to load backup files');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      updateSettings({
        businessName: businessName || 'My Business',
        currency,
        taxPercentage: parseFloat(taxRate) || 0,
        lowStockThreshold: parseInt(lowStockThreshold) || 5,
        notificationsEnabled: enableNotifications,
      });

      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      const filePath = await createBackup();
      Alert.alert('Success', 'Backup created successfully', [
        {
          text: 'Share',
          onPress: async () => {
            try {
              await shareBackup(filePath);
            } catch (error) {
              Alert.alert('Error', 'Failed to share backup');
            }
          },
        },
        { text: 'OK' },
      ]);
      loadBackupFiles();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = (fileName: string) => {
    Alert.alert('Delete Backup', 'Are you sure you want to delete this backup?', [
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await deleteBackupFile(fileName);
            loadBackupFiles();
            Alert.alert('Success', 'Backup deleted');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete backup');
          }
        },
        style: 'destructive',
      },
      { text: 'Cancel' },
    ]);
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all data. This action cannot be undone!',
      [
        {
          text: 'Clear',
          onPress: async () => {
            try {
              setLoading(true);
              await clearAllData();
              Alert.alert('Success', 'All data cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive',
        },
        { text: 'Cancel' },
      ]
    );
  };

  const renderGeneralTab = () => (
    <View className="gap-6 pb-8">
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Business Name</Text>
        <TextInput
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Enter business name"
          className="border border-border rounded-lg p-3 text-foreground bg-surface"
          placeholderTextColor={colors.muted}
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Currency</Text>
        <View className="flex-row gap-2 flex-wrap">
          {['₹', '$', '€', '£', '¥', 'د.إ'].map((curr) => (
            <TouchableOpacity
              key={curr}
              onPress={() => setCurrency(curr)}
              className={`px-4 py-2 rounded-lg border ${
                currency === curr ? 'bg-primary border-primary' : 'border-border bg-surface'
              }`}
            >
              <Text className={currency === curr ? 'text-background font-semibold' : 'text-foreground'}>
                {curr}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Tax Rate (%)</Text>
        <TextInput
          value={taxRate}
          onChangeText={setTaxRate}
          placeholder="Enter tax rate"
          keyboardType="decimal-pad"
          className="border border-border rounded-lg p-3 text-foreground bg-surface"
          placeholderTextColor={colors.muted}
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Low Stock Alert Threshold</Text>
        <TextInput
          value={lowStockThreshold}
          onChangeText={setLowStockThreshold}
          placeholder="Enter quantity threshold"
          keyboardType="number-pad"
          className="border border-border rounded-lg p-3 text-foreground bg-surface"
          placeholderTextColor={colors.muted}
        />
      </View>

      <TouchableOpacity
        onPress={handleSaveSettings}
        disabled={loading}
        className="bg-primary rounded-lg p-4 items-center"
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text className="text-background font-semibold text-base">Save Settings</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderDataTab = () => (
    <View className="gap-4 pb-8">
      <TouchableOpacity
        onPress={handleCreateBackup}
        disabled={loading}
        className="bg-surface border border-border rounded-lg p-4 flex-row items-center gap-3"
      >
        <MaterialIcons name="backup" size={24} color={colors.primary} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">Create Backup</Text>
          <Text className="text-xs text-muted">Export all data to file</Text>
        </View>
        {loading ? <ActivityIndicator /> : <MaterialIcons name="chevron-right" size={24} color={colors.muted} />}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => Alert.alert('Restore', 'Restore functionality coming soon')}
        className="bg-surface border border-border rounded-lg p-4 flex-row items-center gap-3"
      >
        <MaterialIcons name="restore" size={24} color={colors.primary} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">Restore Data</Text>
          <Text className="text-xs text-muted">Import data from backup</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleClearAllData}
        className="bg-surface border border-error rounded-lg p-4 flex-row items-center gap-3"
      >
        <MaterialIcons name="delete-forever" size={24} color={colors.error} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-error">Clear All Data</Text>
          <Text className="text-xs text-muted">Delete everything (irreversible)</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
      </TouchableOpacity>
    </View>
  );

  const renderBackupsTab = () => (
    <View className="gap-4 pb-8">
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : backupFiles.length === 0 ? (
        <View className="items-center py-8">
          <MaterialIcons name="backup" size={48} color={colors.muted} />
          <Text className="text-muted mt-2">No backups yet</Text>
        </View>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={backupFiles}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <View className="bg-surface border border-border rounded-lg p-4 mb-3 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{backupInfo[item]?.date}</Text>
                <Text className="text-xs text-muted">{backupInfo[item]?.size}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteBackup(item)}>
                <MaterialIcons name="delete" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderAdvancedTab = () => (
    <View className="gap-6 pb-8">
      <View className="bg-surface border border-border rounded-lg p-4 flex-row items-center justify-between">
        <View>
          <Text className="text-base font-semibold text-foreground">Enable Notifications</Text>
          <Text className="text-xs text-muted">Low stock alerts</Text>
        </View>
        <Switch value={enableNotifications} onValueChange={setEnableNotifications} />
      </View>

      <View className="bg-surface border border-border rounded-lg p-4 flex-row items-center justify-between">
        <View>
          <Text className="text-base font-semibold text-foreground">Debug Mode</Text>
          <Text className="text-xs text-muted">Show debug information</Text>
        </View>
        <Switch value={debugMode} onValueChange={setDebugMode} />
      </View>

      <TouchableOpacity
        onPress={handleSaveSettings}
        disabled={loading}
        className="bg-primary rounded-lg p-4 items-center"
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text className="text-background font-semibold text-base">Save Advanced Settings</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderAboutTab = () => (
    <View className="gap-4 pb-8">
      <View className="bg-surface border border-border rounded-lg p-6 items-center">
        <MaterialIcons name="store" size={48} color={colors.primary} />
        <Text className="text-2xl font-bold text-foreground mt-4">Grocery Manager Pro</Text>
        <Text className="text-sm text-muted mt-1">v1.0.0</Text>
      </View>

      <View className="bg-surface border border-border rounded-lg p-4">
        <Text className="text-sm font-semibold text-foreground mb-2">About</Text>
        <Text className="text-xs text-muted leading-relaxed">
          A comprehensive offline-first grocery management application designed to help you manage inventory, track sales, and analyze business performance.
        </Text>
      </View>

      <View className="bg-surface border border-border rounded-lg p-4">
        <Text className="text-sm font-semibold text-foreground mb-2">Features</Text>
        <Text className="text-xs text-muted leading-relaxed">
          • Real-time inventory tracking{'\n'}
          • Barcode scanning{'\n'}
          • Sales management{'\n'}
          • Financial reports{'\n'}
          • Expense tracking{'\n'}
          • Offline functionality
        </Text>
      </View>

      <View className="bg-surface border border-border rounded-lg p-4">
        <Text className="text-sm font-semibold text-foreground mb-2">Storage</Text>
        <Text className="text-xs text-muted">All data is stored locally on your device. No internet connection required.</Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">Settings</Text>
          <View className="w-6" />
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-4 px-4 pb-2">
          {(['general', 'data', 'backups', 'advanced', 'about'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`mr-3 px-4 py-2 rounded-full border flex-shrink-0 ${
                activeTab === tab ? 'bg-primary border-primary' : 'border-border bg-surface'
              }`}
            >
              <Text className={activeTab === tab ? 'text-background font-semibold capitalize text-sm' : 'text-foreground capitalize text-sm'}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
          <View className="w-2" />
        </ScrollView>

        {/* Tab Content */}
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'data' && renderDataTab()}
        {activeTab === 'backups' && renderBackupsTab()}
        {activeTab === 'advanced' && renderAdvancedTab()}
        {activeTab === 'about' && renderAboutTab()}
      </ScrollView>
    </ScreenContainer>
  );
}
