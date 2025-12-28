export interface Invoice {
  createdBy: any
  creationDate: string
  lastUpdatedBy: any
  lastUpdateDate: any
  active: any
  id: number
  iic: string
  totalPrice: number
  invoiceOrderNumber: number
  businessUnit: string
  cashRegister: string
  issuerTaxNumber: string
  dateTimeCreated: string
  invoiceRequest: any
  invoiceVersion: number
  fic: string
  iicReference: any
  iicRefIssuingDate: any
  supplyDateOrPeriod: any
  correctiveInvoiceType: any
  baddeptInv: any
  paymentMethod: PaymentMethod[]
  currency: any
  seller: Seller
  buyer: any
  items: Item[]
  sameTaxes: SameTax[]
  fees: any
  approvals: any[]
  iicRefs: any
  invoiceType: string
  typeOfInvoice: string
  isSimplifiedInvoice: boolean
  typeOfSelfIss: any
  invoiceNumber: string
  tcrCode: string
  taxFreeAmt: any
  markUpAmt: any
  goodsExAmt: any
  totalPriceWithoutVAT: number
  totalVATAmount: number
  totalPriceToPay: any
  operatorCode: string
  softwareCode: string
  iicSignature: string
  isReverseCharge: boolean
  payDeadline: any
  paragonBlockNum: any
  taxPeriod: any
  bankAccNum: any
  note: any
  listOfCorrectedInvoiceIIC: any[]
  originalInvoice: any
  badDebtInvoice: any
  issuerInVat: boolean
  badDebt: boolean
}

export interface PaymentMethod {
  id: number
  vouchers: any
  type: string
  amount: number
  compCard: any
  advIIC: any
  bankAcc: any
  typeCode: string
}

export interface Seller {
  idType: string
  idNum: string
  name: string
  address: any
  town: any
  country: any
}

export interface Item {
  id: number
  name: string
  code: string
  unit: string
  quantity: number
  unitPriceBeforeVat: number
  unitPriceAfterVat: number
  rebate: any
  rebateReducing: boolean
  priceBeforeVat: number
  vatRate: number
  vatAmount: number
  priceAfterVat: number
  exemptFromVat: any
  voucherSold: any
  vd: any
  vsn: any
  investment: boolean
}

export interface SameTax {
  id: number
  numberOfItems: number
  priceBeforeVat: number
  vatRate: number
  exemptFromVat: any
  vatAmount: number
}
