# Order Series Validation Fix

## 🐛 Problem

**Error:** "Order series is required" validation error when converting Quote to Sales Order with `draft` status.

**Root Cause:**
- `orderSeries` field was ALWAYS required in the form validation schema
- But when creating SO from Quote, status is `draft` (not `confirmed`)
- Order series should only be required when confirming the order (status = `confirmed`)

---

## ✅ Solution Applied

### 1. Updated Validation Schema
**File:** `src/features/sales-orders/lib/schemas.ts`

**Before:**
```typescript
orderSeries: z.string().min(1, 'Order series is required'), // Always required
```

**After:**
```typescript
orderSeries: z.string().optional().default(''), // Optional by default
```

**Added Conditional Validation:**
```typescript
.refine(
  (data) => {
    // Order series is required ONLY when status is 'confirmed'
    if (data.status === 'confirmed' && !data.orderSeries) {
      return false;
    }
    return true;
  },
  {
    message: 'Order series is required when confirming order',
    path: ['orderSeries'],
  }
)
```

### 2. Updated Quote Conversion
**File:** `src/app/(dashboard)/quotes/quotes-content.tsx`

**Changed:**
```typescript
orderSeries: '', // Empty for draft status - will be required when confirming order
```

---

## 🔄 New Workflow

### Creating SO from Quote (Status = Draft)
```
Quote → Convert to SO
    ↓
Status: 'draft'
Order Series: '' (empty - NOT required)
    ↓
✅ SO created successfully in DRAFT status
    ↓
User can edit and fill Order Series later
    ↓
When user clicks "Confirm Order"
    ↓
❗ Order Series validation triggers
    ↓
If empty → Error: "Order series is required when confirming order"
If filled → ✅ Order confirmed
```

### Manual SO Creation (Status = Draft)
```
Create New SO
    ↓
Status: 'draft' (default)
Order Series: Optional (can leave empty)
    ↓
✅ SO created in DRAFT
    ↓
Later when confirming → Order Series required
```

---

## 📋 Status-Based Validation Rules

| Field | Draft Status | Confirmed Status |
|-------|--------------|------------------|
| Customer | ✅ Required | ✅ Required |
| Order Date | ✅ Required | ✅ Required |
| Delivery Date | ✅ Required | ✅ Required |
| **Order Series** | ⚪ Optional | ✅ **Required** |
| Items | ✅ Required | ✅ Required |

---

## 🧪 Testing

### Test 1: Quote → SO with Draft Status
```
1. Create Quote with 100 qty
2. Approve Quote
3. Convert to SO (split into 2 orders)
4. ✅ Both SOs created with status='draft'
5. ✅ orderSeries='' (empty)
6. ✅ No validation error
```

### Test 2: Confirm Order Without Order Series
```
1. Open SO in draft status
2. Order Series is empty
3. Click "Confirm Order"
4. ❌ Error: "Order series is required when confirming order"
```

### Test 3: Confirm Order With Order Series
```
1. Open SO in draft status
2. Fill Order Series = "GDC 1"
3. Click "Confirm Order"
4. ✅ Order confirmed successfully
```

---

## 🔑 Key Changes

1. **Schema Update**
   - `orderSeries` is now optional by default
   - Added `.refine()` validator that checks status
   - Only enforces requirement when `status === 'confirmed'`

2. **Quote Conversion**
   - Sets `orderSeries = ''` when creating SO from Quote
   - Status is `'draft'` by default
   - No validation error on creation

3. **User Workflow**
   - User can create/convert SOs without filling Order Series
   - When ready to confirm, system validates Order Series
   - Clear error message guides user to fill required field

---

## 📝 Notes

- This fix aligns with business logic: Order Series is needed only when order goes to production/fulfillment
- Draft orders are for review/editing before confirmation
- User has flexibility to fill Order Series when ready to confirm

---

**Fix Date:** September 11, 2026
**Developer:** Claude Sonnet 4.5
**Status:** ✅ Complete - Ready for Testing
