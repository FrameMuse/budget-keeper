import "@/assets/scss/reset.scss"
import "@/assets/scss/base.scss"
import "./App.scss"

import { State, StateArray } from "@denshya/reactive"
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { round } from "lodash-es"



const qrcodeRegionId = "Html5QrcodeScanner"

const TAX_GOV_HOST = "mapr.tax.gov.me"
const TAX_VAT = 21

/**
 * @example
 * https://mapr.tax.gov.me/ic/#/verify?iic=3D0C55CE96F5625625F8EADED816DC81&tin=02793962&crtd=2025-09-27T21:18:16%2002:00&ord=1097292&bu=id956ks726&cr=xj343iq692&sw=it769sl876&prc=6.58
 */
function parseTaxUrl(url: string) {
  try {
    console.log(url)

    const u = new URL(url)
    if (u.host !== TAX_GOV_HOST) return null

    console.log(u)

    const searchParams = new URLSearchParams(url.replace("https://mapr.tax.gov.me/ic/#/verify", ""))
    const p = Object.fromEntries(searchParams.entries())
    const price = parseFloat((p.prc || "0").replace(",", ".")) || 0


    return {
      iic: p.iic,
      date: p.crtd,
      tin: p.tin,
      price,
      tax: price * (TAX_VAT / 100)
    }
  } catch {
    return null
  }
}

function saveBill(taxItem) {
  return fetch("https://budget-keeper-api.framemuse.workers.dev/bills", {
    method: "POST",
    body: JSON.stringify(taxItem),
    headers: { "Content-Type": "application/json" },
    credentials: "include"
  })
}

class Pending extends State<boolean> {
  private count = 0

  async try<T>(task: () => Promise<T> | T): Promise<T> {
    this.count++
    if (this.count === 1) this.set(true)
    try {
      return await task()
    } finally {
      this.count--
      if (this.count === 0) this.set(false)
    }
  }
}


async function AppRoot() {
  const bills = new StateArray(await fetch("https://budget-keeper-api.framemuse.workers.dev/bills", { credentials: "include" }).then(x => x.json()))
  const items = await fetch("https://budget-keeper-api.framemuse.workers.dev/items", { credentials: "include" }).then(x => x.json())

  const analyzedItems = analyzeItems(items)
  // console.log(analyzedItems)

  // const asd = {}
  // items.forEach(item => {
  //   asd[item.iic] ??= 0
  //   asd[item.iic] += calculatePrice(item).priceAfterVat
  // })
  // bills.current.forEach(bill => {
  //   const gg = round(asd[bill.iic], 2)
  //   if (gg !== bill.price) {
  //     console.log("Found duplicates in " + bill.iic, " ", `Bill: ${bill.price} < ${gg}`)
  //   }
  // })



  const manualSubmitPending = new Pending(false)
  // JSON.parse(localStorage.getItem("bought-items") ?? "[]")
  // items.subscribe(value => localStorage.setItem("bought-items", JSON.stringify(value)))

  async function onBillAdd(bill) {
    if (bills.current.find(x => x.iic === bill.iic)) {
      const shouldRemove = confirm("DELETE? This bill was already added, ok to DELETE?")
      if (shouldRemove) {
        await fetch("https://budget-keeper-api.framemuse.workers.dev/bills/" + bill.iic, { method: "DELETE", credentials: "include" })
        bills.set(items => items.filter(x => x.iic !== bill.iic))
      }

      return
    }

    await saveBill(bill)
  }

  function onManualSubmit(event: Event) {
    event.preventDefault()
    const elements = event.currentTarget.elements

    const bill = {
      iic: elements.iic.value,
      date: `${elements.date.value}T${elements.time.value} ${elements.timezone.value}`,
      tin: elements.tin.value,
      price: 0
    }

    manualSubmitPending.try(async () => {
      await onBillAdd(bill)
      alert("All Good: The bill has been added manually, refresh page to see the real price.")
      bills.push(bill)
    })
  }
  // 2025-11-18T17:18:32 01:00
  // 2025-12-18T20:54:56 01:00
  async function onScan() {
    const html5QrcodeScanner = new Html5QrcodeScanner(qrcodeRegionId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      disableFlip: false, // Allow front camera flip (useful for mobile)
      rememberLastUsedCamera: true, // Speeds up switching cameras
      useBarCodeDetectorIfSupported: true,
      showTorchButtonIfSupported: true,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      },
      fps: 30,
      qrbox: 250,
    }, false)
    html5QrcodeScanner.render(async text => {
      html5QrcodeScanner.pause(true)

      try {
        const bill = parseTaxUrl(text)
        console.log(bill)
        if (bill == null) {
          alert("Incorrect Tax Bill: " + text)
          return
        }

        await onBillAdd(bill)
        alert("The bill was added: " + bill.price)
        bills.push(bill)
      } catch (error) {
        alert(`Error happened: ${error.name}: ${error.message}`)
      } finally {
        html5QrcodeScanner.resume()
      }

    }, undefined)
  }

  return (
    <main style={{ marginTop: "1em", display: "grid", gap: "1em" }}>
      <div id={qrcodeRegionId} />
      <div style={{ display: "flex", gap: "4em", padding: "0.75em", background: "#eaeaea", borderRadius: "0.375em" }}>
        <button on={{ click: onScan }}>Scan</button>
      </div>
      <div style={{ display: "flex", gap: "4em", padding: "0.75em", background: "#eaeaea", borderRadius: "0.375em" }}>
        <form style={{ display: "grid", gap: "0.25em" }} on={{ submit: onManualSubmit }}>
          <input type="text" name="tin" placeholder="TIN/PIB" />
          <input type="text" name="iic" placeholder="IIC/IKOF" />
          <input type="date" name="date" />
          <input type="text" name="time" placeholder="Time -> Hours:Minutes:Seconds" on={{ input: formatTime }} />
          <input type="text" name="timezone" placeholder="Time Zone -> Hours:Minutes" on={{ input: formatTimeZone }} />
          <button type="submit">Submit</button>
          {manualSubmitPending.to(x => x ? "Loading..." : "")}
        </form>
      </div>
      <h2>Bills</h2>
      <table>
        <thead>
          <tr>
            <td>id</td>
            <td>price</td>
            <td>date</td>
          </tr>
        </thead>
        <tbody>
          {new StateArray(State.from(bills).to(x => x.sort((a, b) => a.date.localeCompare(b.date)))).map(bill => (
            <tr>
              <td>{bill.iic.slice(0, 5)}...</td>
              <td>{bill.price}</td>
              <td>{bill.date.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
        <caption>
          <div style={{ display: "grid" }}>
            <span>Total + Tax: {State.from(bills).to(x => x.reduce<number>((result, next) => result + next.price, 0)).to(x => x.toFixed(2))}</span>
            <span>Tax: {State.from(bills).to(x => x.reduce<number>((result, next) => result + (next.price * 0.21), 0)).to(x => x.toFixed(2))}</span>
          </div>
        </caption>
      </table>
      <h2>Items</h2>
      <table>
        <thead>
          <tr>
            <td>Category</td>
            <td>Count</td>
            <td>Price</td>
            <td>Percent of Total</td>
          </tr>
        </thead>
        <tbody>
          {analyzedItems.categories.map(category => (
            <tr>
              <td>{category.category}</td>
              <td>{category.lineItems}</td>
              <td>{category.totalAmount}</td>
              <td>{category.percentOfTotal}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Coffee</h2>
      <table>
        <thead>
          <tr>
            <td>Name</td>
            <td>Price</td>
            <td>Percent of Total</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Coffee Shop</td>
            <td>{analyzedItems.coffee.coffeeShop.totalSpent}</td>
            <td>{analyzedItems.coffee.coffeeShop.percentOfTotal}%</td>
          </tr>
          <tr>
            <td>Packaged</td>
            <td>{analyzedItems.coffee.packaged.totalSpent}</td>
            <td>{analyzedItems.coffee.packaged.percentOfTotal}%</td>
          </tr>
        </tbody>
      </table>
    </main>
  )
}

export default AppRoot



function formatTime(event: Event) {
  let v = event.currentTarget.value.replace(/\D/g, "").slice(0, 6)
  if (v.length >= 5) {
    v = v.slice(0, 2) + ":" + v.slice(2, 4) + ":" + v.slice(4)
  } else if (v.length >= 3) {
    v = v.slice(0, 2) + ":" + v.slice(2)
  }
  event.currentTarget.value = v
}
function formatTimeZone(event: Event) {
  let v = event.currentTarget.value.replace(/\D/g, "").slice(0, 4)
  if (v.length >= 3) {
    v = v.slice(0, 2) + ":" + v.slice(2)
  }
  event.currentTarget.value = v
}


/**
 * Full categorization + coffee comparison + percent of total spend
 * Input: items.json array
 * Output: category table with totals + coffee breakdown
 */

/* ---------- CATEGORY RULES ---------- */

const CATEGORY_RULES = [
  { category: "Dairy & Eggs", keywords: ["mlijeko", "sir", "jogurt", "maslac", "jaja", "urda", "philadelphia"] },
  { category: "Meat & Fish", keywords: ["pile", "pilet", "goved", "june", "cevap", "kobas", "prsut", "losos", "skusa", "riba"] },
  { category: "Bakery & Bread", keywords: ["hljeb", "kifla", "baget", "tost", "kroas", "lisnato", "mafini"] },
  { category: "Prepared & Frozen", keywords: ["pizza", "smrznut", "grilovan", "pomfrit"] },
  { category: "Produce", keywords: ["paradajz", "salata", "jabuka", "banana", "pomorand", "mandarina", "krastavac", "spanac", "brokoli"] },
  { category: "Pasta, Rice & Grains", keywords: ["pasta", "makaron", "fusilli", "tagliatelle", "riza", "pirinac"] },
  { category: "Sauces & Spices", keywords: ["sos", "origano", "bosiljak", "lovor", "sirce", "bijeli luk"] },
  { category: "Sweets & Snacks", keywords: ["cokolad", "kinder", "snickers", "biskvit", "cips", "vafel", "sladoled"] },
  { category: "Drinks – Non-Alcoholic", keywords: ["voda", "cola", "sprite", "sok"] },
  { category: "Drinks – Alcoholic", keywords: ["cider", "vino", "pivo"] },
  { category: "Household & Cleaning", keywords: ["krpa", "maramice", "papir", "kesa"] },
  { category: "Personal Care & Health", keywords: ["cetkica", "maska", "fervex", "strepsils"] },
  { category: "Kitchen & Tools", keywords: ["presa", "pleh", "ketridz"] },
  { category: "Books & Media", keywords: ["harry potter", "book"] }
]

/* ---------- COFFEE RULES ---------- */

const PACKAGED_COFFEE_KEYWORDS = [
  "kafa",
  "jacobs",
  "kronung",
  "instant"
]

const COFFEE_SHOP_KEYWORDS = [
  "caffe",
  "latte",
  "cappucino",
  "cappuccino",
  "frappuccino",
  "espresso",
  "plazmacino"
]

/* ---------- HELPERS ---------- */

function detectCategory(name) {
  const n = name.toLowerCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => n.includes(k))) {
      return rule.category
    }
  }
  return "Other"
}

function isPackagedCoffee(name) {
  const n = name.toLowerCase()
  return PACKAGED_COFFEE_KEYWORDS.some(k => n.includes(k))
}

function isCoffeeShopDrink(name, unit) {
  const n = name.toLowerCase()
  return (
    COFFEE_SHOP_KEYWORDS.some(k => n.includes(k)) ||
    unit?.toLowerCase().includes("serv")
  )
}

/* ---------- MAIN AGGREGATION ---------- */

function analyzeItems(items) {
  const categories = {}
  let grandTotal = 0

  const coffee = {
    packaged: { qty: 0, total: 0 },
    shop: { qty: 0, total: 0 }
  }

  for (const item of items) {
    const name = item.name || ""
    const unit = item.unit || ""
    const qty = Number(item.quantity)

    const { priceAfterVat } = calculatePrice(item)

    grandTotal += priceAfterVat

    const category = detectCategory(name)
    if (!categories[category]) {
      categories[category] = {
        category,
        lineItems: 0,
        totalAmount: 0
      }
    }

    categories[category].lineItems += 1
    categories[category].totalAmount += priceAfterVat

    if (isPackagedCoffee(name)) {
      coffee.packaged.qty += qty
      coffee.packaged.total += priceAfterVat
    } else if (isCoffeeShopDrink(name, unit)) {
      coffee.shop.qty += qty
      coffee.shop.total += priceAfterVat
    }
  }

  const categoryTable = Object.values(categories).map(c => ({
    category: c.category,
    lineItems: c.lineItems,
    totalAmount: Number(c.totalAmount.toFixed(2)),
    percentOfTotal: Number(((c.totalAmount / grandTotal) * 100).toFixed(2))
  }))

  return {
    categories: categoryTable.sort((a, b) => b.totalAmount - a.totalAmount),
    coffee: {
      packaged: {
        totalSpent: Number(coffee.packaged.total.toFixed(2)),
        percentOfTotal: Number(((coffee.packaged.total / grandTotal) * 100).toFixed(2))
      },
      coffeeShop: {
        totalSpent: Number(coffee.shop.total.toFixed(2)),
        percentOfTotal: Number(((coffee.shop.total / grandTotal) * 100).toFixed(2))
      },
      difference: Number((coffee.shop.total - coffee.packaged.total).toFixed(2))
    },
    grandTotal: Number(grandTotal.toFixed(2))
  }
}

/**
 * Calculate final price with VAT and rebate
 * @param {number} unitPriceBeforeVat - original price per unit before VAT
 * @param {number} vatRate - VAT in percent (e.g., 21)
 * @param {number} rebate - rebate in percent (e.g., 38)
 * @param {boolean} rebateReducing - true if rebate applies after VAT, false if before VAT
 * @returns {object} - { priceBeforeVat, vatAmount, priceAfterVat }
 */
function calculatePrice(item) {
  let priceBeforeVat, vatAmount, priceAfterVat

  const rebateMOD = (1 - item.rebate / 100)
  const vatMOD = (item.vat_rate / 100)

  if (!item.rebate_reducing) {
    // Rebate reduces the price before VAT
    priceBeforeVat = item.unit_price_before_vat * item.quantity * rebateMOD
    vatAmount = priceBeforeVat * vatMOD
    priceAfterVat = priceBeforeVat + vatAmount
  } else {
    // Rebate reduces the price after VAT
    priceBeforeVat = item.unit_price_before_vat * item.quantity
    vatAmount = priceBeforeVat * vatMOD
    priceAfterVat = (priceBeforeVat + vatAmount) * rebateMOD
  }

  // Round to 4 decimals for clarity
  return {
    priceBeforeVat: round(priceBeforeVat, 2),
    vatAmount: round(vatAmount, 2),
    priceAfterVat: round(priceAfterVat, 2)
  }
}
