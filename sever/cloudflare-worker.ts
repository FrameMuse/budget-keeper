export default {
  async fetch(request: Request, env) {
    const origin = request.headers.get("Origin")

    // Allow only your frontend (recommended)
    const allowedOrigins = [
      "http://localhost:5173",
      "https://budget-keeper.framemuse.workers.dev",
    ]

    const corsHeaders =
      allowedOrigins.includes(origin)
        ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, CF-Access-Jwt-Assertion",
        }
        : {}



    // Clone and attach CORS headers
    const headers = new Headers
    for (const [k, v] of Object.entries(corsHeaders)) {
      headers.set(k, v)
    }

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers })
    }

    const url = new URL(request.url)
    const urlParams = new URLSearchParams(url.search)

    const startDate = urlParams.get("startDate")
    const endDate = urlParams.get("endDate")

    const startDateWhere = startDate ? ` AND date >= '${startDate}'` : ""
    const endDateWhere = endDate ? ` AND date <= '${endDate}'` : ""

    const method = request.method
    const pathParts = url.pathname.split("/").filter(Boolean) // split path

    if (pathParts[0] === "fix" && pathParts[1] === "items" && pathParts[2] === "rebate") {
      return await fixItemsRebate(env.DB)
    }

    // /bills or /bills/:id
    if (pathParts[0] === "bills") {
      // GET all bills
      if (method === "GET" && pathParts.length === 1) {
        const response = await env.DB.prepare("SELECT * FROM bills WHERE 1=1" + startDateWhere + endDateWhere).all()
        headers.set("Content-Type", "application/json")
        return new Response(JSON.stringify(response.results), { headers })
      }

      // POST to create
      if (method === "POST" && pathParts.length === 1) {
        const { iic, tin, date } = await request.json()
        const invoice = await verifyInvoice(iic, tin, date)
        await env.DB.prepare("INSERT INTO bills (iic, tin, date, price, seller) VALUES (?, ?, ?, ?, ?)").bind(iic, tin, date, invoice.totalPrice, invoice.seller.name).run()
        const stmt = env.DB.prepare("INSERT INTO items (iic, id, name, quantity, unit_price_before_vat, vat_rate, unit, rebate, rebate_reducing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        const batch = invoice.items.map(item =>
          stmt.bind(
            iic,
            item.id ?? -1,
            item.name,
            item.quantity,
            item.unitPriceBeforeVat,
            item.vatRate,
            item.unit,
            item.rebate,
            item.rebateReducing,
          )
        )

        await env.DB.batch(batch)
        return new Response(null, { status: 204, headers })
      }

      // DELETE by id
      if (method === "DELETE" && pathParts.length === 2) {
        const iic = pathParts[1]
        await env.DB.prepare("DELETE FROM bills WHERE iic = ?").bind(iic).run()
        return new Response(null, { status: 204, headers })
      }
    }
    if (pathParts[0] === "items") {
      // GET all items
      if (method === "GET" && pathParts.length === 1) {
        const iic = url.searchParams.get("iic")
        const response = await env.DB.prepare(
          "SELECT items.* " +
          "FROM items " +
          "JOIN bills ON bills.iic = items.iic " +
          "WHERE 1=1" +
          (iic ? " AND items.iic=" + iic : "") +
          startDateWhere.replace("date", "bills.date") +
          endDateWhere.replace("date", "bills.date")
        ).all()
        headers.set("Content-Type", "application/json")
        return new Response(JSON.stringify(response.results), { headers })
      }

      // const requestPayload = await request.json()
      // const isBulk = Array.isArray(requestPayload)

      // // POST to create
      // if (method === 'POST' && pathParts.length === 1 && !isBulk) {
      //   const { iic, id, name, quantity, unit_price_before_vat, vat_rate, unit } = requestPayload
      //   await env.DB.prepare('INSERT INTO items (iic, id, name, quantity, unit_price_before_vat, vat_rate, unit) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(iic, id, name, quantity, unit_price_before_vat, vat_rate, unit).run();
      //   return new Response(null, { status: 204, headers });
      // }

      // // POST to create BULK
      // if (method === 'POST' && pathParts.length === 1 && isBulk && requestPayload.length > 0) {

      //   return new Response(null, { status: 204, headers });
      // }
    }

    return new Response(null, { status: 404, headers })
  }
}

function verifyInvoice(iic, tin, dateTimeCreated) {
  const formData = new FormData
  formData.set("iic", iic)
  formData.set("tin", tin)
  formData.set("dateTimeCreated", dateTimeCreated)

  return fetch("https://mapr.tax.gov.me/ic/api/verifyInvoice", {
    method: "POST",
    body: formData
  }).then(x => x.json())
}

async function fixItemsRebate(db) {
  const bills = await db.prepare("SELECT iic, tin, date FROM bills").all()
  bills.results.splice(0, 30)
  // const bills = { results: [{ iic: "E713ED1AEB7568986DDE892C33B078D0", tin: "02440261", date: "2025-12-22T14:37:00 01:00" }] }

  const textEncoder = new TextEncoder()
  const responseStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(textEncoder.encode("Started proccessing: <br><br>"))

      for (const bill of bills.results) {
        try {
          controller.enqueue(textEncoder.encode(`<br>- Fetching bill: ${bill.iic}`))
          const invoice = await verifyInvoice(bill.iic, bill.tin, bill.date)
          if (!invoice.items) throw new TypeError("Bill has not items, likely incorrect data")

          // controller.enqueue(textEncoder.encode(`, fetching items`))

          controller.enqueue(textEncoder.encode(`, fixing items`))
          for (const item of invoice.items) {
            const rebate = item.rebate ?? 0
            const rebateReducing = item.rebateReducing ? 1 : 0 // store as 0/1

            await db.prepare(`
              UPDATE items
              SET rebate = ?, rebate_reducing = ?
              WHERE iic = ? AND name = ? AND unit = ? AND unit_price_before_vat = ? AND quantity = ? AND vat_rate = ?
            `).bind(
              rebate,
              rebateReducing,

              bill.iic,
              item.name,
              item.unit,
              item.unitPriceBeforeVat,
              item.quantity,
              item.vatRate,
            ).run()
          }

          controller.enqueue(textEncoder.encode(` - Success <br>`))
        } catch (err) {
          console.error(`Failed for IIC ${bill.iic}:`, err)
          controller.enqueue(textEncoder.encode(` - Failed (${err.name + err.message}) <br>`))
        }
      }

      controller.enqueue(textEncoder.encode("<br><br>Finished."))
      controller.close()
    }
  })
  return new Response(responseStream, { headers: { "Content-Type": "text/html" } })
}
