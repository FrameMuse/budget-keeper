import "@/assets/scss/reset.scss"
import "@/assets/scss/base.scss"

import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from "html5-qrcode"


const qrcodeRegionId = "Html5QrcodeScanner"

function AppRoot() {
  return (
    <main>
      <div id={qrcodeRegionId} />
      <div>
        <button on={{
          click: () => {
            const html5QrcodeScanner = new Html5QrcodeScanner(qrcodeRegionId, {
              supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
              fps: 30,
              qrbox: 50
            }, false)
            html5QrcodeScanner.render(text => {
              alert(text)
              html5QrcodeScanner.pause(true)
            }, undefined)
          }
        }}>Scan</button>
      </div>
    </main>
  )
}

export default AppRoot
