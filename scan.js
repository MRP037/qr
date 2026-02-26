// GANTI URL INI dengan Web App URL kamu ("/exec")
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxa1VIM7EJfJ95noXZx3n450zCjxHsNUUI1QEvV-JKnBX9rEsZTO75IWuPA1AiJmnaK/exec";

const statusScan = document.getElementById("statusScan");
const autoPopup  = document.getElementById("autoPopup");
const autoIcon   = document.getElementById("autoIcon");
const autoText   = document.getElementById("autoText");

let html5QrCode;
let canScan = true;   // kontrol jeda antar scan
let isScannerReady = false;

function showPopup(type, message) {
  // type: "success" | "error" | "warning"
  autoIcon.className = "icon";
  if (type === "success") {
    autoIcon.classList.add("success");
    autoIcon.textContent = "✔";
  } else if (type === "warning") {
    autoIcon.classList.add("success");
    autoIcon.textContent = "!";
  } else {
    autoIcon.classList.add("error");
    autoIcon.textContent = "✖";
  }
  autoText.textContent = message || "";
  autoPopup.classList.add("show");

  // Sembunyikan popup setelah 2.5 detik
  setTimeout(() => {
    autoPopup.classList.remove("show");
  }, 2500);
}

function setStatusText(text) {
  statusScan.textContent = text;
}

// Kirim hasil scan ke Apps Script
async function sendToSheet(codeValue) {
  if (!codeValue) return;

  setStatusText("Mengirim ke server...");

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
        qrText: codeValue,
        panitia: "" // kalau mau nambah nama panitia, bisa diganti
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("HTTP " + res.status + " " + res.statusText + " | " + text);
    }

    const data = await res.json();
    console.log("Response:", data);

    if (data.status === "success") {
      showPopup("success", "Scan Berhasil - Baru Diambil");
      setStatusText("Berhasil dicatat. Tunggu 7 detik sebelum scan berikutnya...");
    } else if (data.status === "already_taken") {
      showPopup("warning", "Sudah Pernah Diambil");
      setStatusText("Kode ini sudah pernah diambil. Tunggu 7 detik...");
    } else if (data.status === "not_found") {
      showPopup("error", "Kode Tidak Ditemukan");
      setStatusText("Kode tidak ditemukan di data. Tunggu 7 detik...");
    } else {
      showPopup("error", "Error: " + (data.message || "Tidak diketahui"));
      setStatusText("Terjadi error. Tunggu 7 detik sebelum coba lagi.");
    }

  } catch (err) {
    console.error(err);
    showPopup("error", "Gagal ke server");
    setStatusText("Gagal komunikasi dengan server. Cek koneksi.");
  } finally {
    // jeda 7 detik sebelum scan berikutnya
    setScanEnable(false);
    setTimeout(() => {
      setScanEnable(true);
      setStatusText("Arahkan QR ke kamera");
    }, 7000);
  }
}

function setScanEnable(enable) {
  canScan = enable;
}

// Mulai scanner kamera
function startScanner() {
  const qrCodeRegionId = "reader";

  if (html5QrCode) {
    html5QrCode.clear().catch(() => {});
  }
  html5QrCode = new Html5Qrcode(qrCodeRegionId);

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 }
  };

  Html5Qrcode.getCameras().then(devices => {
    if (!devices || devices.length === 0) {
      setStatusText("Kamera tidak ditemukan.");
      return;
    }

    // pilih kamera belakang kalau ada
    let cameraConfig = { facingMode: "environment" };
    if (devices.length > 1 && devices[1].id) {
      cameraConfig = { deviceId: { exact: devices[1].id } };
    }

    html5QrCode.start(
      cameraConfig,
      config,
      (decodedText) => {
        if (!isScannerReady || !canScan) return;
        // begitu dapat 1 hasil, matikan sementara scan
        setScanEnable(false);
        isScannerReady = false;

        const val = decodedText.trim();
        console.log("Scanned:", val);
        setStatusText("Kode terbaca, memproses...");

        html5QrCode.stop().then(() => {
          sendToSheet(val);
        }).catch(err => {
          console.error("Gagal stop scanner:", err);
          showPopup("error", "Error stop kamera");
          setStatusText("Error stop scanner: " + err);
          // tetap aktifkan lagi setelah jeda
          setTimeout(() => {
            setScanEnable(true);
            setStatusText("Arahkan QR ke kamera");
            startScanner();
          }, 7000);
        });
      },
      () => {
        // error per frame diabaikan
      }
    ).then(() => {
      isScannerReady = true;
      setScanEnable(true);
      setStatusText("Arahkan QR ke kamera");
    }).catch(err => {
      console.error("Gagal start scan:", err);
      showPopup("error", "Gagal akses kamera");
      setStatusText("Gagal mengakses kamera: " + err);
    });
  }).catch(err => {
    console.error("Html5Qrcode.getCameras error:", err);
    showPopup("error", "Tidak bisa akses kamera");
    setStatusText("Tidak bisa mengakses kamera.");
  });
}

// mulai saat halaman siap
document.addEventListener("DOMContentLoaded", () => {
  startScanner();
});