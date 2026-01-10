/**
 * improved-categorizer.js
 *
 * Usage:
 *   const items = require('./items.json');
 *   const manualMap = { "mystery item name fragment": "Bakery & Bread" }; // optional overrides
 *   const res = analyzeAndImprove(items, manualMap);
 *   console.table(res.categories);
 *   console.log("Top remaining Other items:", res.topOther.slice(0,20));
 */

import { calculatePrice } from "./calc"

/* ---------- CATEGORY RULES (expanded) ---------- */
const CATEGORY_RULES = [
  { category: "Dairy & Eggs", keywords: ["kulen ", "mlijeko", "milk", "sir", "butter", "maslac", "jogurt", "yogurt", "jaja", "egg", "eggs", "philadelphia", "gouda", "gauda", "urda"] },
  { category: "Meat & Fish", keywords: ["cevapcici", "zlatiborac rinfuz", "zlatiborac slajs", "salama", "pile", "pilet", "chicken", "goved", "beef", "govedina", "mljeveno", "mljeven", "minced", "losos", "salmon", "skusa", "tuna", "riba", "prosciutto", "prsut", "salami", "kobas", "sausage", "bacon"] },
  { category: "Bakery & Bread", keywords: ["margarin", "lisnato", "kroas.", "bakin", "coko", "coco", "tortilja", "7 days", "hljeb", "bread", "tost", "toast", "baget", "baguette", "kifla", "roll", "croissant", "kroasan", "pecivo", "pastry", "panini", "bake"] },
  { category: "Prepared & Frozen", keywords: ["smrznut", "frozen", "pizza", "pomfrit", "ready meal", "frozen pizza", "frozen vegetables", "gotov", "grill", "grilovan"] },
  { category: "Produce", keywords: ["grozde", "pomodoro", "meksicki mix", "paradajz", "tomato", "krastavac", "cucumber", "jabuka", "apple", "banana", "orange", "pomorand", "mandarina", "salat", "mjesavina", "lettuce", "spinach", "brokoli", "broccoli", "fruit", "vegetable", "krompir", "sampinjoni"] },
  { category: "Pasta, Rice & Grains", keywords: ["pasta", "fusilli", "tagliatelle", "pappardelle", "riz", "rice", "pirinac", "grain", "flour", "couscous"] },
  { category: "Sauces & Spices", keywords: ["kotanyi kesica", "secer", "mirodjija", "persun", "lovorov", "sos", "sauce", "soy", "soja", "origano", "bosiljak", "garlic", "garlic powder", "pepper", "salt", "ketchup", "mayonnaise", "mustard"] },
  { category: "Sweets & Snacks", keywords: ["mafini", "cokolad", "chocolate", "kinder", "snickers", "biskvit", "biscuit", "cookie", "chips", "cips", "waffle", "vafel", "sladoled", "ice cream", "candy"] },
  { category: "Drinks – Non-Alcoholic", keywords: ["plazmaccino", "voda", "water", "cola", "coca", "sprite", "sok", "juice", "coffee", "kafa", "caffe", "latte", "espresso", "tea", "caj", "frappuccino"] },
  { category: "Drinks – Alcoholic", keywords: ["cider", "somersby", "vino", "wine", "pivo", "beer", "vodka", "rum"] },
  { category: "Household & Cleaning", keywords: ["krpa", "cloth", "napkin", "maramice", "tissue", "paper", "bakingsheet", "baking paper", "detergent", "soap", "cleaner", "bleach"] },
  { category: "Personal Care & Health", keywords: ["toalet papir", "ob apollix", "toothbrush", "cetkica", "mask", "maska", "shampoo", "conditioner", "fervex", "strepsils", "medic", "tablet", "ointment", "skincare"] },
  { category: "Kitchen & Tools", keywords: ["papir za pecenje", "presa", "pleh", "tool", "knife", "pan", "pot", "kettle", "filter", "press", "utensil", "grater"] },
  { category: "Electronics & Tech", keywords: ["elektro", "usb", "charger", "battery", "headphone", "earbud", "phone", "cable", "adapter", "mouse", "keyboard"] },
  { category: "Clothing & Accessories", keywords: ["shirt", "socks", "cap", "gloves", "scarf", "hat", "jacket"] },
  { category: "Books & Media", keywords: ["book", "dvd", "harry potter", "magazine"] },
  { category: "Kesa", keywords: ["kesa"] },
  { category: "Child food", keywords: ["nutrino"] },
]

/* ---------- COFFEE RULES ---------- */
const PACKAGED_COFFEE_KEYWORDS = ["kafa", "instant", "nescafe", "jacobs", "kronung", "jar", "ground coffee", "coffee beans", "arabica"]
const COFFEE_SHOP_KEYWORDS = ["cappucino", "caffe", "latte", "cappuccino", "frappuccino", "espresso", "macchiato", "flat white", "americano", "plazmaccino"]

/* ---------- UTIL: Levenshtein distance & similarity ---------- */
function levenshtein(a, b) {
  if (!a) return b ? b.length : 0
  if (!b) return a.length
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= m; i++) {
      const cur = dp[i]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + cost)
      prev = cur
    }
  }
  return dp[m]
}
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - (levenshtein(a, b) / maxLen)
}

/* ---------- CORE DETECTION ---------- */
function detectCategoryExact(name) {
  const n = (name || "").toLowerCase()
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (n.includes(kw)) return rule.category
    }
  }
  return null
}

function detectCoffee(name, unit) {
  const n = (name || "").toLowerCase()
  if (PACKAGED_COFFEE_KEYWORDS.some(k => n.includes(k))) return "packaged"
  if (COFFEE_SHOP_KEYWORDS.some(k => n.includes(k))) return "shop"
  if ((unit || "").toLowerCase().includes("serv") || (unit || "").toLowerCase().includes("kom")) {
    // heuristics: "serv" or single-serving units often indicate cafe/drink
    if (n.includes("caffe") || n.includes("latte") || n.includes("espresso")) return "shop"
  }
  return null
}

/* ---------- fuzzy reclassifier ---------- */
function fuzzyAssign(name, existingKeywordsMap) {
  // existingKeywordsMap: array of {category, keyword}
  const n = (name || "").toLowerCase()
  let best = { score: 0, category: null, match: null }
  for (const ek of existingKeywordsMap) {
    const s = similarity(n, ek.keyword)
    if (s > best.score) { best = { score: s, category: ek.category, match: ek.keyword } }
  }
  // threshold tuned experimentally; 0.62 is conservative, increase to be stricter
  return best.score >= 0.62 ? { category: best.category, confidence: best.score, matchedKeyword: best.match } : null
}

/* ---------- MAIN: analyze, attempt auto-fix, present suggestions ---------- */
export function analyzeItems(items, manualMap = {}) {
  // manualMap: exact substring => category (applied first)
  const categories = {}
  let grandTotal = 0

  // build keyword map from rules for fuzzy matching
  const keywordMap = []
  for (const r of CATEGORY_RULES) {
    for (const kw of r.keywords) keywordMap.push({ category: r.category, keyword: kw })
  }

  // first pass: assign exact / keyword based categories and collect Other
  const others = []
  const assigned = []
  const coffee = { packaged: { qty: 0, total: 0 }, shop: { qty: 0, total: 0 } }

  for (const item of items) {
    const name = item.name
    const unit = item.unit
    const qty = item.quantity

    const { priceAfterVat, unitPriceAfterVat } = calculatePrice(item)

    const price = unitPriceAfterVat
    const total = priceAfterVat
    grandTotal += total

    // manual overrides (substring match)
    let cat = null
    for (const key in manualMap) {
      if (name.toLowerCase().includes(key.toLowerCase())) {
        cat = manualMap[key]
        break
      }
    }

    // coffee detection
    const coffeeKind = detectCoffee(name, unit)
    if (coffeeKind === "packaged") {
      coffee.packaged.qty += qty; coffee.packaged.total += total
    } else if (coffeeKind === "shop") {
      coffee.shop.qty += qty; coffee.shop.total += total
    }

    if (!cat) cat = detectCategoryExact(name)

    if (!cat) {
      others.push({ name, qty, price, total, unit })
    } else {
      if (!categories[cat]) categories[cat] = { lineItems: 0, totalAmount: 0 }
      categories[cat].lineItems += 1
      categories[cat].totalAmount += total
      assigned.push({ name, category: cat, total })
    }
  }

  // second pass: attempt fuzzy assign for top Other items (by spend)
  others.sort((a, b) => b.total - a.total)
  const autoAssigned = []
  const stillOther = []

  for (const o of others) {
    const fuzzy = fuzzyAssign(o.name, keywordMap)
    if (fuzzy) {
      // apply if confidence good OR price large (we prefer high-confidence)
      if (!categories[fuzzy.category]) categories[fuzzy.category] = { lineItems: 0, totalAmount: 0 }
      categories[fuzzy.category].lineItems += 1
      categories[fuzzy.category].totalAmount += o.total
      autoAssigned.push({ ...o, assignedCategory: fuzzy.category, confidence: +(fuzzy.confidence.toFixed(2)) })
    } else {
      stillOther.push(o)
    }
  }

  // compute final category table and percentages
  const catRows = []
  for (const [cat, info] of Object.entries(categories)) {
    catRows.push({
      category: cat,
      lineItems: info.lineItems,
      totalAmount: Number(info.totalAmount.toFixed(2)),
      percentOfTotal: Number(((info.totalAmount / (grandTotal || 1)) * 100).toFixed(2))
    })
  }

  // add Other aggregated row (remaining Others)
  const otherTotal = stillOther.reduce((s, i) => s + i.total, 0)
  catRows.push({
    category: "Other",
    lineItems: stillOther.length,
    totalAmount: Number(otherTotal.toFixed(2)),
    percentOfTotal: Number(((otherTotal / (grandTotal || 1)) * 100).toFixed(2))
  })

  // coffee percentages
  const coffeeSummary = {
    packaged: { totalSpent: Number(coffee.packaged.total.toFixed(2)), percentOfTotal: Number(((coffee.packaged.total / (grandTotal || 1)) * 100).toFixed(2)) },
    coffeeShop: { totalSpent: Number(coffee.shop.total.toFixed(2)), percentOfTotal: Number(((coffee.shop.total / (grandTotal || 1)) * 100).toFixed(2)) },
    difference: Number(((coffee.shop.total - coffee.packaged.total)).toFixed(2))
  }

  // sort categories by spend descending (put Other last)
  const sortedCats = catRows
    .filter(r => r.category !== "Other")
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .concat(catRows.filter(r => r.category === "Other"))

  return {
    categories: sortedCats,
    grandTotal: Number(grandTotal.toFixed(2)),
    autoAssigned,
    topOther: stillOther, // unsolved items for manual labeling (sorted by spend)
    coffee: coffeeSummary
  }
}

/* ---------- Example inline usage (uncomment for Node) ---------- */
/*
const items = require('./items.json');

// Optional: manual map for tricky strings; keep keys short and unique substrings
const manualMap = {
  "pressa za krompir": "Kitchen & Tools",
  "mlijeko u prahu": "Dairy & Eggs",
  "domaci kruh": "Bakery & Bread"
};

const report = analyzeAndImprove(items, manualMap);
console.table(report.categories);
console.log("Grand total:", report.grandTotal);
console.log("Coffee:", report.coffee);
console.log("Auto-assigned examples:", report.autoAssigned.slice(0,10));
console.log("Top remaining 'Other' items (label these to reduce Other):", report.topOther.slice(0,20));
*/
