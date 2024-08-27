export function getPropByKey(obj: any, key: string) {
  const keys = key.split('.');
  let result = obj;
  for (const key1 of keys) {
    if (result) {
      result = result[key1];
    }
  }
  return result;
}

export function shortAddress(address?: string, len = 5) {
  if (!address) return '';
  if (address.length <= len * 2) return address;
  return address.slice(0, len) + '...' + address.slice(address.length - len);
}

export type SortField<T> = [keyof T, comparator: (a: T[keyof T], b: T[keyof T]) => number];

export function sortByMultiFields<T>(arr: T[], fields: SortField<T>[]): T[] {
  return arr.sort((a, b) => {
    for (const [key, comparator] of fields) {
      const result = comparator(a[key], b[key]);
      if (result !== 0) return result;
    }
    return 0;
  });
}