import {
  calculateOrderTotals,
  canStudentCancelOrder,
  isValidVendorTransition,
} from '../../server/services/order.service.ts';

describe('Order Business Rules & Pricing Unit Tests', () => {
  test('UT-01: calculates subtotal, tax, flat platform fee, and grand total accurately', () => {
    const totals = calculateOrderTotals(378, 5, 5);
    expect(totals.subtotal).toBe(378);
    expect(totals.taxAmount).toBe(18.9);
    expect(totals.platformFee).toBe(5);
    expect(totals.totalAmount).toBe(401.9);
  });

  test('UT-02: allows student cancellation only in configured pre-preparation statuses', () => {
    expect(canStudentCancelOrder('Placed', 'Placed,Accepted')).toBe(true);
    expect(canStudentCancelOrder('Accepted', 'Placed,Accepted')).toBe(true);
    expect(canStudentCancelOrder('Preparing', 'Placed,Accepted')).toBe(false);
    expect(canStudentCancelOrder('Ready', 'Placed,Accepted')).toBe(false);
    expect(canStudentCancelOrder('Completed', 'Placed,Accepted')).toBe(false);
  });

  test('UT-03: enforces valid vendor order lifecycle transitions', () => {
    expect(isValidVendorTransition('Placed', 'Accepted')).toBe(true);
    expect(isValidVendorTransition('Placed', 'Rejected')).toBe(true);
    expect(isValidVendorTransition('Placed', 'Completed')).toBe(false);
    expect(isValidVendorTransition('Accepted', 'Preparing')).toBe(true);
    expect(isValidVendorTransition('Preparing', 'Ready')).toBe(true);
    expect(isValidVendorTransition('Ready', 'Completed')).toBe(true);
    expect(isValidVendorTransition('Cancelled', 'Accepted')).toBe(false);
  });
});
