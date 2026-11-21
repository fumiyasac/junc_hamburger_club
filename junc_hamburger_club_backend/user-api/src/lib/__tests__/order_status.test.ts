import { allowedNext, canTransition, isValidOrderStatus } from '../order_status';

describe('allowedNext', () => {
  test('received → preparing, cancelled', () => {
    expect(allowedNext('received')).toEqual(['preparing', 'cancelled']);
  });
  test('preparing → ready, cancelled', () => {
    expect(allowedNext('preparing')).toEqual(['ready', 'cancelled']);
  });
  test('ready → completed のみ (キャンセル不可)', () => {
    expect(allowedNext('ready')).toEqual(['completed']);
  });
  test('completed / cancelled は終端', () => {
    expect(allowedNext('completed')).toEqual([]);
    expect(allowedNext('cancelled')).toEqual([]);
  });
});

describe('canTransition', () => {
  test('ready → cancelled は不可', () => {
    expect(canTransition('ready', 'cancelled')).toBe(false);
  });
  test('preparing → cancelled は可', () => {
    expect(canTransition('preparing', 'cancelled')).toBe(true);
  });
  test('逆戻り遷移は不可', () => {
    expect(canTransition('ready', 'preparing')).toBe(false);
    expect(canTransition('preparing', 'received')).toBe(false);
  });
});

describe('isValidOrderStatus', () => {
  test('既知の値は true', () => {
    expect(isValidOrderStatus('received')).toBe(true);
  });
  test('未知の値は false', () => {
    expect(isValidOrderStatus('xxx')).toBe(false);
  });
});
