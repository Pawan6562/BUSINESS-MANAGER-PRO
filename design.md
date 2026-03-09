# Grocery Manager Pro - Mobile App Design

## Overview

Grocery Manager Pro is an offline-first inventory and sales management application designed for small grocery businesses. The app runs entirely on the device with no internet or backend required. It provides real-time inventory tracking, barcode scanning, low-stock alerts, sales management, and financial reporting.

---

## Screen List

The app consists of the following primary screens organized in a tab-based navigation structure:

| Screen | Purpose | Key Features |
|--------|---------|--------------|
| **Dashboard** | Home screen with business overview | Sales summary, low-stock alerts, quick actions, today's revenue |
| **Inventory** | Manage product inventory | List all items, add new products, edit quantities, view details |
| **Add/Edit Product** | Create or modify products | Barcode scanning, product name, cost, selling price, stock quantity |
| **Barcode Scanner** | Scan product barcodes | Camera-based barcode detection, quick product lookup |
| **Sales/POS** | Process sales transactions | Add items to cart, apply discounts, checkout, generate receipt |
| **Sales History** | View past transactions | Filter by date, view receipts, refund options |
| **Reports** | Financial analytics | Monthly profit/loss, expense tracking, revenue trends, inventory value |
| **Settings** | App configuration | Backup/restore data, currency settings, low-stock thresholds, about |

---

## Primary Content and Functionality

### Dashboard Screen
- **Header**: Business name, current date, time
- **Key Metrics Cards**: 
  - Today's Sales (revenue)
  - Total Items in Stock
  - Low Stock Items Count
  - Monthly Profit/Loss
- **Low Stock Alerts**: List of items below threshold with quick restock action
- **Quick Actions**: Buttons to start new sale, add inventory, scan barcode
- **Recent Sales**: Last 5 transactions with time and amount

### Inventory Screen
- **Search Bar**: Filter products by name or barcode
- **Product List**: 
  - Product name, current quantity, unit cost, selling price
  - Color-coded stock status (green=good, yellow=low, red=critical)
  - Swipe actions: edit, delete, quick add/remove quantity
- **Add Button**: Floating action button to add new product
- **Bulk Actions**: Select multiple items for batch operations

### Add/Edit Product Screen
- **Product Name**: Text input
- **Barcode Field**: Manual entry or scan button
- **Cost Price**: Input for purchase cost
- **Selling Price**: Input for retail price
- **Current Stock**: Quantity input
- **Reorder Level**: Low-stock threshold
- **Unit Type**: Dropdown (pieces, kg, liters, etc.)
- **Save/Cancel Buttons**: Bottom action buttons

### Barcode Scanner Screen
- **Camera View**: Full-screen camera preview
- **Barcode Detection**: Real-time barcode detection overlay
- **Scanned Item Display**: Show matched product or option to create new
- **Manual Entry**: Fallback text input for manual barcode entry
- **Close Button**: Return to previous screen

### Sales/POS Screen
- **Cart Section**: 
  - List of items added to sale
  - Quantity adjustment per item
  - Remove item option
  - Subtotal display
- **Product Quick Add**: 
  - Search/scan to add products
  - Recent items for quick access
- **Checkout Section**:
  - Subtotal, discount input, tax calculation
  - Total amount due
  - Payment method selection (cash, card, etc.)
  - Complete Sale button
- **Receipt Preview**: Show before finalizing

### Sales History Screen
- **Date Filter**: Select date range
- **Transaction List**:
  - Date and time
  - Items count
  - Total amount
  - Payment method
- **Transaction Details**: Tap to view full receipt and refund option
- **Export Option**: Share or print receipts

### Reports Screen
- **Time Period Selector**: Daily, weekly, monthly, custom range
- **Metrics Displayed**:
  - Total Revenue
  - Total Expenses
  - Profit/Loss
  - Average Transaction Value
  - Top Selling Items
  - Inventory Value
- **Charts**: Line chart for revenue trend, pie chart for category breakdown
- **Export**: Download reports as CSV or PDF

### Settings Screen
- **Data Management**:
  - Backup to device storage
  - Restore from backup
  - Clear all data (with confirmation)
- **App Settings**:
  - Currency symbol
  - Low-stock alert threshold
  - Tax percentage
  - Business name
- **About**: App version, help, privacy policy

---

## Key User Flows

### Flow 1: Add New Product via Barcode Scan
1. User taps "Add Product" on Dashboard or Inventory screen
2. Camera opens with barcode scanner
3. User scans product barcode
4. App checks if barcode exists (if yes, show existing product; if no, create new)
5. User enters product name, cost, selling price, initial quantity
6. User taps "Save"
7. Product added to inventory, user returns to Dashboard

### Flow 2: Sell Items (POS)
1. User taps "New Sale" on Dashboard
2. Sales/POS screen opens with empty cart
3. User scans product barcode or searches by name
4. Product added to cart with quantity 1
5. User adjusts quantity if needed (swipe or tap quantity field)
6. User repeats steps 3-5 for additional items
7. User reviews cart, applies discount if applicable
8. User taps "Checkout"
9. App deducts items from inventory
10. Receipt displayed with option to print/share
11. Sale recorded in history, user returns to Dashboard

### Flow 3: Monitor Low Stock
1. User opens Dashboard
2. "Low Stock Alerts" section shows items below reorder level
3. User taps alert to view product details
4. User taps "Add Stock" button
5. Quick add quantity dialog appears
6. User enters quantity to add
7. Inventory updated, alert cleared from dashboard

### Flow 4: View Financial Reports
1. User taps "Reports" tab
2. Reports screen shows current month data
3. User selects different time period (weekly, custom range)
4. Charts and metrics update
5. User taps on chart element to drill down
6. User exports report or shares via email

---

## Color Choices

The app uses a professional, grocery-focused color scheme optimized for readability and accessibility:

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| **Primary** | Fresh Green | #22C55E | Buttons, active states, success indicators |
| **Secondary** | Professional Blue | #0a7ea4 | Links, secondary actions |
| **Background** | Clean White | #FFFFFF | Main background (light mode) |
| **Surface** | Light Gray | #F5F5F5 | Cards, panels, input backgrounds |
| **Text Primary** | Dark Gray | #11181C | Main text, headings |
| **Text Secondary** | Medium Gray | #687076 | Secondary text, labels |
| **Success** | Bright Green | #22C55E | Successful actions, good stock levels |
| **Warning** | Amber | #F59E0B | Low stock alerts, caution states |
| **Error** | Red | #EF4444 | Out of stock, errors, deletions |
| **Border** | Light Border | #E5E7EB | Dividers, card borders |
| **Dark Mode Background** | Very Dark | #151718 | Dark mode main background |
| **Dark Mode Surface** | Dark Gray | #1e2022 | Dark mode cards and panels |

---

## Navigation Structure

The app uses a **tab-based bottom navigation** with 4 primary tabs:

1. **Dashboard** (Home icon) - Overview and quick actions
2. **Inventory** (Box icon) - Product management
3. **Sales** (ShoppingCart icon) - POS and sales history
4. **Reports** (BarChart icon) - Analytics and financial data

**Secondary Navigation**: Settings and detailed screens are accessed via stack navigation from tabs.

---

## Design Principles

- **Mobile-First**: Optimized for portrait orientation (9:16), one-handed usage
- **Offline-First**: All data stored locally, no internet dependency
- **Accessibility**: High contrast, readable fonts, clear touch targets (min 44×44 pt)
- **Efficiency**: Minimal taps to complete common tasks (add product, process sale)
- **Feedback**: Clear visual feedback for all actions (loading states, success messages, error alerts)
- **Consistency**: Uniform component styling, predictable navigation patterns

---

## Technical Implementation Notes

- **Local Storage**: SQLite for structured data (products, sales, expenses)
- **State Management**: React Context + AsyncStorage for app settings
- **Notifications**: Local push notifications for low-stock alerts
- **Barcode Scanning**: Expo Camera + barcode detection library
- **Charts**: React Native chart library for financial reports
- **Styling**: NativeWind (Tailwind CSS) for consistent, maintainable styling
