import "@/assets/scss/reset.scss"
import "@/assets/scss/base.scss"

import { State, StateArray } from "@denshya/reactive"
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode"



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
      tin: Number(p.tin),
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

async function AppRoot() {
  const bills = new StateArray(await fetch("https://budget-keeper-api.framemuse.workers.dev/bills", { credentials: "include" }).then(x => x.json()))
  // JSON.parse(localStorage.getItem("bought-items") ?? "[]")
  // items.subscribe(value => localStorage.setItem("bought-items", JSON.stringify(value)))

  return (
    <main>
      <div id={qrcodeRegionId} />
      <div>
        <button on={{
          click: () => {
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
                const taxItem = parseTaxUrl(text)
                console.log(taxItem)
                if (taxItem == null) {
                  alert("Incorrect Tax Bill: " + text)
                  return
                }

                if (bills.current.find(x => x.id === taxItem.iic)) {
                  const shouldRemove = confirm("This bill was already added, remove?")
                  if (shouldRemove) {
                    await fetch("https://budget-keeper-api.framemuse.workers.dev/bills/" + taxItem.iic, { method: "DELETE", credentials: "include" })
                    bills.set(items => items.filter(x => x.id !== taxItem.iic))
                  }

                  return
                }

                await saveBill(taxItem)
                alert("The bill was added: " + taxItem.price)
                bills.push(taxItem)
              } catch (error) {
                alert(`Error happened: ${error.name}: ${error.message}`)
              } finally {
                html5QrcodeScanner.resume()
              }

            }, undefined)
          }
        }}>Scan</button>
      </div>
      <table>
        <thead>
          <tr>
            <td>id</td>
            <td>price</td>
            <td>date</td>
          </tr>
        </thead>
        <tbody>
          {bills.map(bill => (
            <tr>
              <td>{bill.id.slice(0, 5)}...</td>
              <td>{bill.price}</td>
              <td>{bill.date.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
        <caption>
          Total: {State.from(bills).to(x => x.reduce<number>((result, next) => result + next.price, 0)).to(x => x.toFixed(2))}
        </caption>
      </table>
    </main>
  )
}

export default AppRoot
