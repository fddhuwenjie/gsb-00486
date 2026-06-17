import type { UnitSystem, Ingredient } from '@shared/types';

const unitConversions: Record<string, { metric: number; imperial: number; unit: string }> = {
  g: { metric: 1, imperial: 0.035274, unit: 'oz' },
  kg: { metric: 1000, imperial: 35.274, unit: 'oz' },
  ml: { metric: 1, imperial: 0.00422675, unit: 'cup' },
  l: { metric: 1000, imperial: 4.22675, unit: 'cup' },
  '°C': { metric: 1, imperial: 1.8, unit: '°F' },
  celsius: { metric: 1, imperial: 1.8, unit: 'fahrenheit' },
};

const imperialToMetric: Record<string, { factor: number; unit: string }> = {
  oz: { factor: 28.3495, unit: 'g' },
  lb: { factor: 453.592, unit: 'g' },
  cup: { factor: 236.588, unit: 'ml' },
  '°F': { factor: 1, unit: '°C' },
  fahrenheit: { factor: 1, unit: 'celsius' },
};

export const convertWeight = (
  value: number,
  fromUnit: string,
  toSystem: UnitSystem
): { value: number; unit: string } => {
  const from = fromUnit.toLowerCase();

  if (toSystem === 'imperial') {
    if (from === 'g' || from === 'gram' || from === '克') {
      return { value: Math.round(value * 0.035274 * 100) / 100, unit: 'oz' };
    }
    if (from === 'kg' || from === '千克' || from === '公斤') {
      return { value: Math.round(value * 2.20462 * 100) / 100, unit: 'lb' };
    }
  } else {
    if (from === 'oz' || from === '盎司') {
      return { value: Math.round(value * 28.3495 * 10) / 10, unit: 'g' };
    }
    if (from === 'lb' || from === '磅') {
      return { value: Math.round(value * 453.592 * 10) / 10, unit: 'g' };
    }
  }

  return { value, unit: fromUnit };
};

export const convertVolume = (
  value: number,
  fromUnit: string,
  toSystem: UnitSystem
): { value: number; unit: string } => {
  const from = fromUnit.toLowerCase();

  if (toSystem === 'imperial') {
    if (from === 'ml' || from === '毫升') {
      return { value: Math.round((value / 236.588) * 100) / 100, unit: 'cup' };
    }
    if (from === 'l' || from === '升') {
      return { value: Math.round((value * 1000 / 236.588) * 100) / 100, unit: 'cup' };
    }
  } else {
    if (from === 'cup' || from === '杯') {
      return { value: Math.round(value * 236.588 * 10) / 10, unit: 'ml' };
    }
  }

  return { value, unit: fromUnit };
};

export const convertTemperature = (
  value: number,
  fromUnit: string,
  toSystem: UnitSystem
): { value: number; unit: string } => {
  const from = fromUnit.toLowerCase();

  if (toSystem === 'imperial') {
    if (from === '°c' || from === 'c' || from.includes('摄氏')) {
      return { value: Math.round((value * 1.8 + 32) * 10) / 10, unit: '°F' };
    }
  } else {
    if (from === '°f' || from === 'f' || from.includes('华氏')) {
      return { value: Math.round(((value - 32) / 1.8) * 10) / 10, unit: '°C' };
    }
  }

  return { value, unit: fromUnit };
};

export const convertIngredient = (
  ingredient: Ingredient,
  toSystem: UnitSystem
): Ingredient => {
  const unit = ingredient.unit.toLowerCase();
  const isWeightUnit = ['g', 'gram', '克', 'kg', '千克', '公斤', 'oz', '盎司', 'lb', '磅'].some(
    (u) => unit.includes(u)
  );
  const isVolumeUnit = ['ml', '毫升', 'l', '升', 'cup', '杯'].some((u) => unit.includes(u));
  const isTempUnit = ['°c', 'c', '摄氏', '°f', 'f', '华氏'].some((u) => unit.includes(u));

  if (isWeightUnit) {
    const result = convertWeight(ingredient.amount, ingredient.unit, toSystem);
    return { ...ingredient, amount: result.value, unit: result.unit };
  }

  if (isVolumeUnit) {
    const result = convertVolume(ingredient.amount, ingredient.unit, toSystem);
    return { ...ingredient, amount: result.value, unit: result.unit };
  }

  if (isTempUnit) {
    const result = convertTemperature(ingredient.amount, ingredient.unit, toSystem);
    return { ...ingredient, amount: result.value, unit: result.unit };
  }

  return ingredient;
};

export const convertIngredients = (
  ingredients: Ingredient[],
  toSystem: UnitSystem
): Ingredient[] => {
  return ingredients.map((ing) => convertIngredient(ing, toSystem));
};

export const formatAmount = (amount: number): string => {
  if (Number.isInteger(amount)) {
    return amount.toString();
  }
  return amount.toFixed(1).replace(/\.0$/, '');
};
