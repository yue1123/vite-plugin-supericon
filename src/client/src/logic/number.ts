export function tryFixDecimal(num: number, decimalCount: number = 2) {
  const fixed = num.toFixed(decimalCount)

  if (Number(fixed) === num) {
    return num
  }
  return Number(fixed)
}
