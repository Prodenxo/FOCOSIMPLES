const allSameDigits = (d) => /^(\d)\1+$/.test(d);

export function isValidCnpjDigits(digits) {
  if (digits.length !== 14 || allSameDigits(digits)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calc = (weights) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i += 1) {
      sum += parseInt(digits[i], 10) * weights[i];
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  if (calc(weights1) !== parseInt(digits[12], 10)) return false;
  return calc(weights2) === parseInt(digits[13], 10);
}
