async function verifyInvoice(iic, tin, dateTimeCreated) {
  const formData = new FormData()
  formData.set("iic", iic)
  formData.set("tin", tin)
  formData.set("dateTimeCreated", dateTimeCreated)

  const res = await fetch("https://mapr.tax.gov.me/ic/api/verifyInvoice", {
    method: "POST",
    body: formData
  })
  return res.json()
}

async function updateItemsInOrder(db) {
  const bills = await db.prepare("SELECT iic, tin, date FROM bills").all()

  for (const bill of bills.results) {
    try {
      const invoice = await verifyInvoice(bill.iic, bill.tin, bill.date)
      if (!invoice.items) continue

      // Fetch all items for this bill in order
      const dbItems = await db.prepare("SELECT rowid FROM items WHERE iic = ? ORDER BY rowid").bind(bill.iic).all()

      for (let i = 0; i < invoice.items.length; i++) {
        const item = invoice.items[i]
        const rowid = dbItems.results[i]?.rowid
        if (!rowid) continue

        const rebate = item.rebate ?? 0
        const rebateReducing = item.rebateReducing ? 1 : 0

        await db.prepare(`
          UPDATE items SET rebate = ?, rebateReducing = ? WHERE rowid = ?
        `).bind(rebate, rebateReducing, rowid).run()
      }
    } catch (err) {
      console.error(`Failed for IIC ${bill.iic}:`, err)
    }
  }
}

await updateItemsInOrder(DB)
