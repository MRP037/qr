// GANTI URL INI dengan Web App URL kamu (yang GET-nya sudah muncul {"status":"ok"...})
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxVFs4szyh16RKtBJTFoEcvksiNbCwMHBOctQbgfWfL21tPCjLNvpUOn9JQa9ajCOl_/exec";

const statusScan = document.getElementById("statusScan");
const autoPopup  = document.getElementById("autoPopup");
const autoIcon   = document.getElementById("autoIcon");
const autoText   = document.getElementById("autoText");

let html5QrCode;
let bolehScan = true;   // jeda antar scan

function setStatus(text) {
  statusScan.textContent = text;
}

function showPopup(tipe, pesan) {
  autoIcon.className = "icon";
  if (tipe === "success") {
    autoIcon.classList.add("success");
    autoIcon.textContent = "✔";
  } else if (tipe === "warning") {
    autoIcon.classList.add("success");
    autoIcon.textContent = "!";
  } else {
    autoIcon.classList.add("error");
    autoIcon.textContent = "✖";
  }
  autoText.textContent = pesan;
  autoPopup.classList.add("show");
  setTimeout(() => autoPopup.classList.remove("show"), 2500);
}

async function kirimKeServer(kode) {
  setStatus("Mengirim ke server...");

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        qrText: kode,
        panitia: "" // bisa diisi nanti kalau mau
      })
    });

    // Kalau HTTP status bukan 2xx
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.log("RESP RAW:", text);
      throw new Error("HTTP " + res.status + " " + res.statusText);
    }

    const data = await res.json(); // <- di sini kadang error, kita pantau
    console.log("RESP JSON:", data);

    if (data.status === "success") {
      showPopup("success", "Scan baru, berhasil dicatat");
      setStatus("Berhasil dicatat. Tunggu 7 detik...");
    } else if (data.status === "already_taken") {
      showPopup("warning", "Kode sudah pernah diambil");
      setStatus("Kode sudah pernah diambil. Tunggu 7 detik...");
    } else if (data.status === "not_found") {
      showPopup("error", "Kode tidak ditemukan");
      setStatus("Kode tidak ditemukan di Sheet1. Tunggu 7 detik...");
    } else {
      showPopup("error", "Error: " + (data.message || "Tidak diketahui"));
      setStatus("Terjadi error. Tunggu 7 detik...");
    }
  } catch (err) {
    console.error("FETCH ERROR:", err);
    showPopup("error", "Gagal ke server");
    setStatus("Gagal komunikasi dengan server: " + err.message);
  } finally {
    bolehScan = false;
    setTimeout(() => {
      bolehScan = true;
      setStatus("Arahkan QR ke kamera");
      mulaiScanner(); // aktifkan lagi kamera setelah jeda
    }, 7000);
  }
}

function mulaiScanner() {
  const divId = "reader";
  if (html5QrCode) {
    html5QrCode.clear().catch(() => {});
  }
  html5QrCode = new Html5Qrcode(divId);

  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  Html5Qrcode.getCameras().then(devices => {
    if (!devices || devices.length === 0) {
      setStatus("Kamera tidak ditemukan");
      return;
    }

    const camConfig = { facingMode: "environment" };

    html5QrCode.start(
      camConfig,
      config,
      (decodedText) => {
        if (!bolehScan) return; // lagi jeda
        bolehScan = false;

        const kode = decodedText.trim();
        console.log("SCAN:", kode);
        setStatus("Kode terbaca, proses ke server...");

        html5QrCode.stop().then(() => {
          kirimKeServer(kode);
        }).catch(err => {
          console.error("STOP ERROR:", err);
          showPopup("error", "Error stop kamera");
          setStatus("Error stop kamera: " + err.message);
          // tetep kasih jeda lalu nyalakan lagi
          setTimeout(() => {
            bolehScan = true;
            mulaiScanner();
          }, 7000);
        });
      },
      () => {
        // error per frame diabaikan
      }
    ).then(() => {
      setStatus("Arahkan QR ke kamera");
      bolehScan = true;
    }).catch(err => {
      console.error("START ERROR:", err);
      showPopup("error", "Gagal akses kamera");
      setStatus("Gagal akses kamera: " + err.message);
    });
  }).catch(err => {
    console.error("CAMERA ERROR:", err);
    showPopup("error", "Tidak bisa akses kamera");
    setStatus("Tidak bisa akses kamera");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setStatus("Memulai kamera...");
  mulaiScanner();
});