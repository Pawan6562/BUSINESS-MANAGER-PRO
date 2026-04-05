import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { addExpense, getExpensesByDateRange, deleteExpense, Expense } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const EXPENSE_CATEGORIES = [
  { id: 'rent', label: 'Rent', icon: 'home' },
  { id: 'utilities', label: 'Utilities', icon: 'flash-on' },
  { id: 'electricity', label: 'Electricity Bill', icon: 'bolt' },
  { id: 'internet', label: 'Internet / Phone', icon: 'wifi' },
  { id: 'supplies', label: 'Supplies', icon: 'shopping-cart' },
  { id: 'packaging', label: 'Packaging', icon: 'inventory' },
  { id: 'staff', label: 'Staff', icon: 'people' },
  { id: 'maintenance', label: 'Maintenance', icon: 'build' },
  { id: 'transport', label: 'Transport', icon: 'local-shipping' },
  { id: 'marketing', label: 'Marketing', icon: 'campaign' },
  { id: 'loan', label: 'Loan / EMI', icon: 'account-balance' },
  { id: 'tax', label: 'Tax / GST', icon: 'receipt' },
  { id: 'other', label: 'Other', icon: 'more-horiz' },
];

export default function ExpensesScreen() {
  const router = useRouter();
  const { settings } = useAppStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('supplies');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // today, week, month, all
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [dateFilter])
  );

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate = new Date(2020, 0, 1);
    }

    return { startDate: startDate.getTime(), endDate: now.getTime() };
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();
      const allExpenses = await getExpensesByDateRange(startDate, endDate);
      setExpenses(allExpenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    try {
      if (!description.trim()) {
        Alert.alert('Validation Error', 'Please enter a description');
        return;
      }

      const expenseAmount = parseFloat(amount);
      if (!expenseAmount || expenseAmount <= 0) {
        Alert.alert('Validation Error', 'Please enter a valid amount');
        return;
      }

      setSubmitting(true);

      const newExpense = await addExpense({
        category: selectedCategory,
        description: description.trim(),
        amount: expenseAmount,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset form
      setDescription('');
      setAmount('');
      setSelectedCategory('supplies');
      setShowAddModal(false);

      // Reload expenses
      await loadExpenses();
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', 'Failed to add expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = (expenseId: string) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense(expenseId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await loadExpenses();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete expense');
          }
        },
      },
    ]);
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const categoryExpenses = EXPENSE_CATEGORIES.map((cat) => ({
    ...cat,
    total: expenses
      .filter((exp) => exp.category === cat.id)
      .reduce((sum, exp) => sum + exp.amount, 0),
  }));

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-4 pb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold text-foreground">Expenses</Text>
            <Text className="text-sm text-muted mt-1">Track your business costs</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            className="bg-primary rounded-lg p-3"
          >
            <MaterialIcons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Total Expenses Card */}
        <View className="px-4 mb-6">
          <View className="bg-primary/10 border border-primary rounded-lg p-6">
            <Text className="text-sm text-muted mb-2">Total Expenses ({dateFilter})</Text>
            <Text className="text-4xl font-bold text-primary">
              {settings.currency}{totalExpenses.toFixed(2)}
            </Text>
            <Text className="text-xs text-muted mt-2">{expenses.length} transaction(s)</Text>
          </View>
        </View>

        {/* Date Filter */}
        <View className="px-4 mb-6">
          <View className="flex-row gap-2">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setDateFilter(filter.id)}
                className={`flex-1 py-2 px-3 rounded-lg border ${
                  dateFilter === filter.id
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-border'
                }`}
              >
                <Text
                  className={`text-center text-xs font-semibold ${
                    dateFilter === filter.id ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Category Breakdown */}
        {categoryExpenses.some((cat) => cat.total > 0) && (
          <View className="px-4 mb-6">
            <Text className="text-lg font-bold text-foreground mb-3">By Category</Text>
            {categoryExpenses
              .filter((cat) => cat.total > 0)
              .map((category) => (
                <View
                  key={category.id}
                  className="bg-surface border border-border rounded-lg p-4 mb-2 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="bg-primary/10 rounded-lg p-2">
                      <MaterialIcons name={category.icon as any} size={20} color="#0a7ea4" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">{category.label}</Text>
                      <Text className="text-xs text-muted">
                        {expenses.filter((exp) => exp.category === category.id).length} item(s)
                      </Text>
                    </View>
                  </View>
                  <Text className="font-bold text-primary">
                    {settings.currency}{category.total.toFixed(2)}
                  </Text>
                </View>
              ))}
          </View>
        )}

        {/* Expenses List */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">Recent Expenses</Text>

          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#0a7ea4" />
            </View>
          ) : expenses.length === 0 ? (
            <View className="bg-surface border border-border rounded-lg p-6 items-center">
              <MaterialIcons name="receipt-long" size={40} color="#687076" />
              <Text className="text-muted text-center mt-2">No expenses recorded yet</Text>
            </View>
          ) : (
            expenses.map((expense) => {
              const category = EXPENSE_CATEGORIES.find((cat) => cat.id === expense.category);
              return (
                <View
                  key={expense.id}
                  className="bg-surface border border-border rounded-lg p-4 mb-3 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="bg-warning/10 rounded-lg p-2">
                      <MaterialIcons
                        name={category?.icon as any}
                        size={20}
                        color="#F59E0B"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">{expense.description}</Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Text className="text-xs text-muted">{category?.label}</Text>
                        <Text className="text-xs text-muted">•</Text>
                        <Text className="text-xs text-muted">
                          {new Date(expense.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="font-bold text-foreground">
                      {settings.currency}{expense.amount.toFixed(2)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteExpense(expense.id)}
                      className="p-2"
                    >
                      <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-surface rounded-t-3xl p-6 pb-8">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-foreground">Add Expense</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <MaterialIcons name="close" size={28} color="#687076" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category Selection */}
              <View className="mb-6">
                <Text className="text-sm font-semibold text-foreground mb-3">Category</Text>
                <View className="flex-row flex-wrap gap-2">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.id)}
                      className={`flex-row items-center gap-2 px-4 py-3 rounded-lg border ${
                        selectedCategory === cat.id
                          ? 'bg-primary border-primary'
                          : 'bg-surface border-border'
                      }`}
                    >
                      <MaterialIcons
                        name={cat.icon as any}
                        size={18}
                        color={selectedCategory === cat.id ? '#fff' : '#0a7ea4'}
                      />
                      <Text
                        className={`font-semibold text-sm ${
                          selectedCategory === cat.id ? 'text-white' : 'text-foreground'
                        }`}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View className="mb-6">
                <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
                <TextInput
                  placeholder="e.g., Monthly rent, Cleaning supplies..."
                  placeholderTextColor="#9BA1A6"
                  value={description}
                  onChangeText={setDescription}
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                />
              </View>

              {/* Amount */}
              <View className="mb-6">
                <Text className="text-sm font-semibold text-foreground mb-2">Amount</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg font-bold text-foreground">{settings.currency}</Text>
                  <TextInput
                    placeholder="0.00"
                    placeholderTextColor="#9BA1A6"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                  />
                </View>
              </View>

              {/* Buttons */}
              <View className="flex-row gap-3 mt-6">
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  className="flex-1 bg-surface border border-border rounded-lg py-4"
                >
                  <Text className="text-foreground font-bold text-center">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAddExpense}
                  disabled={submitting}
                  className="flex-1 bg-primary rounded-lg py-4 flex-row items-center justify-center"
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="check" size={20} color="#fff" />
                      <Text className="text-white font-bold ml-2">Add Expense</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
