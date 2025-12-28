import "@/assets/scss/reset.scss"
import "@/assets/scss/base.scss"

import { Html5QrcodeScanner } from "html5-qrcode"


const qrcodeRegionId = "Html5QrcodeScanner"

function AppRoot() {

  return (
    <main>
      <div id={qrcodeRegionId} />
      <div>
        <button on={{
          click: () => {
            const html5QrcodeScanner = new Html5QrcodeScanner(qrcodeRegionId, {} as never, false)
            html5QrcodeScanner.render(text => {
              alert(text)
            }, undefined)
          }
        }}>Scan</button>
      </div>
    </main>
  )
}

export default AppRoot
