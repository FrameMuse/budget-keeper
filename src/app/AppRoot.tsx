import "@/assets/scss/reset.scss"
import "@/assets/scss/base.scss"

import { State, StateArray } from "@denshya/reactive"
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from "html5-qrcode"


const qrcodeRegionId = "Html5QrcodeScanner"

const TAX_GOV_HOST = "mapr.tax.gov.me"
const TAX_VAT = 21

/**
 * @example
 * https://mapr.tax.gov.me/ic/#/verify?iic=3D0C55CE96F5625625F8EADED816DC81&tin=02793962&crtd=2025-09-27T21:18:16%2002:00&ord=1097292&bu=id956ks726&cr=xj343iq692&sw=it769sl876&prc=6.58
 */
function parseTaxUrl(url: string) {
  try {
    const u = new URL(url)
    if (u.host !== TAX_GOV_HOST) return null


    const p = Object.fromEntries(u.searchParams.entries())
    const price = parseFloat((p.prc || "0").replace(",", ".")) || 0


    return {
      id: p.iic,
      date: p.crtd,
      price,
      tax: price * (TAX_VAT / 100),
      raw: p,
      items: [],
      expanded: false,
    }
  } catch {
    return null
  }
}

function AppRoot() {
  const items = new StateArray(JSON.parse(localStorage.getItem("bought-items") ?? "[]"))
  items.subscribe(value => localStorage.setItem("bought-items", JSON.stringify(value)))

  return (
    <main>
      <div id={qrcodeRegionId} />
      <div>
        <button on={{
          click: () => {
            const html5QrcodeScanner = new Html5QrcodeScanner(qrcodeRegionId, {
              supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
              // videoConstraints: {
              //   aspectRatio: 1,
              // },
              fps: 30,
              qrbox: (w, h) => ({ width: w * 0.75, height: h * 0.75 })
            }, false)
            html5QrcodeScanner.render(text => {
              const taxItem = parseTaxUrl(text)
              if (taxItem == null) {
                alert("Incorrect Tax Bill: " + text)
                return
              }

              if (items.current.find(x => x.id === taxItem.id)) {
                const shouldRemove = confirm("This bill was already added, remove?")
                if (shouldRemove) {
                  items.set(items => items.filter(x => x.id !== taxItem.id))
                }

                return
              }

              items.push(taxItem)

              html5QrcodeScanner.pause(true)
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
          {items.map(item => (
            <tr>
              <td>{item.id}</td>
              <td>{item.price}</td>
              <td>{item.date.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
        <caption>
          Total: {State.from(items).to(x => x.reduce((result, next) => result + next.price, 0))}
        </caption>
      </table>
    </main>
  )
}

export default AppRoot
