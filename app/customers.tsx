import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, FlatList, Alert, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { Customer, getAllCustomers, addCustomer, updateCustomer, deleteCustomer, getCustomerByPhone } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useColors } from '@/hooks/use-colors';
import { MaterialIcons } from '@expo/vector-icons';

export default function CustomersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { settings } = useAppStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [])
  );

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    try {
      // Check if customer with same phone already exists
      if (formData.phone.trim()) {
        const existing = await getCustomerByPhone(formData.phone);
        if (existing) {
          Alert.alert('Error', 'Customer with this phone number already exists');
          return;
        }
      }

      await addCustomer({
        name: formData.name,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        loyaltyPoints: 0,
        totalSpent: 0,
        purchaseCount: 0,
      });

      setFormData({ name: '', phone: '', email: '' });
      setShowAddForm(false);
      await loadCustomers();
      Alert.alert('Success', 'Customer added successfully');
    } catch (error) {
      console.error('Error adding customer:', error);
      Alert.alert('Error', 'Failed to add customer');
    }
  };

  const handleDeleteCustomer = (customerId: string, customerName: string) => {
    Alert.alert('Delete Customer', `Are you sure you want to delete ${customerName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomer(customerId);
            await loadCustomers();
            Alert.alert('Success', 'Customer deleted');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete customer');
          }
        },
      },
    ]);
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery)) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderCustomerCard = ({ item }: { item: Customer }) => (
    <View className="bg-surface border border-border rounded-lg p-4 mb-3">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
          {item.phone && <Text className="text-sm text-muted">{item.phone}</Text>}
          {item.email && <Text className="text-xs text-muted">{item.email}</Text>}
        </View>
        <TouchableOpacity onPress={() => handleDeleteCustomer(item.id, item.name)} className="p-2">
          <MaterialIcons name="delete" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-4 mt-3 pt-3 border-t border-border">
        <View className="flex-1">
          <Text className="text-xs text-muted mb-1">Total Spent</Text>
          <Text className="text-base font-semibold text-primary">
            {settings.currency}
            {item.totalSpent.toFixed(2)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs text-muted mb-1">Purchases</Text>
          <Text className="text-base font-semibold text-success">{item.purchaseCount}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs text-muted mb-1">Loyalty Points</Text>
          <Text className="text-base font-semibold text-warning">{item.loyaltyPoints}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <MaterialIcons name="hourglass-empty" size={48} color={colors.primary} />
        <Text className="text-foreground mt-4">Loading customers...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4 pt-4 pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground flex-1 ml-2">Customers</Text>
          <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)} className="bg-primary rounded-lg p-3">
            <MaterialIcons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Add Customer Form */}
        {showAddForm && (
          <View className="bg-surface border border-primary rounded-lg p-4 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Add New Customer</Text>

            <TextInput
              placeholder="Customer Name *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              className="bg-background border border-border rounded-lg p-3 text-foreground mb-3"
              placeholderTextColor="#687076"
            />

            <TextInput
              placeholder="Phone Number"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
              className="bg-background border border-border rounded-lg p-3 text-foreground mb-3"
              placeholderTextColor="#687076"
            />

            <TextInput
              placeholder="Email Address"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              className="bg-background border border-border rounded-lg p-3 text-foreground mb-4"
              placeholderTextColor="#687076"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleAddCustomer}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-white font-semibold">Add Customer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowAddForm(false);
                  setFormData({ name: '', phone: '', email: '' });
                }}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search */}
        <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 mb-6">
          <MaterialIcons name="search" size={20} color={colors.muted} />
          <TextInput
            placeholder="Search customers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 py-3 px-2 text-foreground"
            placeholderTextColor={colors.muted}
          />
        </View>

        {/* Stats */}
        {filteredCustomers.length > 0 && (
          <View className="flex-row gap-3 mb-6">
            <View className="flex-1 bg-primary/10 border border-primary rounded-lg p-3">
              <Text className="text-xs text-muted mb-1">Total Customers</Text>
              <Text className="text-2xl font-bold text-primary">{customers.length}</Text>
            </View>
            <View className="flex-1 bg-success/10 border border-success rounded-lg p-3">
              <Text className="text-xs text-muted mb-1">Total Revenue</Text>
              <Text className="text-lg font-bold text-success">
                {settings.currency}
                {customers.reduce((sum, c) => sum + c.totalSpent, 0).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Customers List */}
        {filteredCustomers.length > 0 ? (
          <FlatList
            data={filteredCustomers}
            renderItem={renderCustomerCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center py-12">
            <MaterialIcons name="people-outline" size={48} color={colors.muted} />
            <Text className="text-foreground mt-4 text-center">
              {searchQuery ? 'No customers found' : 'No customers yet. Add one to get started!'}
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
