import { round } from "lodash-es"


/**
 * Calculate final price with VAT and rebate
 * @param {number} unitPriceBeforeVat - original price per unit before VAT
 * @param {number} vatRate - VAT in percent (e.g., 21)
 * @param {number} rebate - rebate in percent (e.g., 38)
 * @param {boolean} rebateReducing - true if rebate applies after VAT, false if before VAT
 * @returns {object} - { priceBeforeVat, vatAmount, priceAfterVat }
 */
export function calculatePrice(item) {
  let unitPriceAfterVat, priceBeforeVat, vatAmount, priceAfterVat

  const rebateMOD = (1 - item.rebate / 100)
  const vatMOD = (item.vat_rate / 100)

  if (!item.rebate_reducing) {
    // Rebate reduces the price before VAT
    priceBeforeVat = item.unit_price_before_vat * item.quantity * rebateMOD
    vatAmount = priceBeforeVat * vatMOD
    priceAfterVat = priceBeforeVat + vatAmount

    unitPriceAfterVat = item.unit_price_before_vat * rebateMOD + vatAmount
  } else {
    // Rebate reduces the price after VAT
    priceBeforeVat = item.unit_price_before_vat * item.quantity
    vatAmount = priceBeforeVat * vatMOD
    priceAfterVat = (priceBeforeVat + vatAmount) * rebateMOD

    unitPriceAfterVat = (item.unit_price_before_vat + vatAmount) * rebateMOD
  }

  // Round to 4 decimals for clarity
  return {
    unitPriceAfterVat: round(unitPriceAfterVat, 2),
    priceBeforeVat: round(priceBeforeVat, 2),
    vatAmount: round(vatAmount, 2),
    priceAfterVat: round(priceAfterVat, 2)
  }
}
