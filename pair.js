// Parowanie dwóch telefonów bez internetu: wspólne Wi-Fi/hotspot + WebRTC, wymiana danych połączenia przez kody QR.
'use strict';
const Pair = (() => {
  let pc = null, dc = null, role = null, onMsg = () => {}, onState = () => {};
  const PREFIX = 'DART1:';

  async function pack(desc) { // skrócenie SDP + kompresja, żeby kod QR był mały
    const keep = desc.sdp.split(/\r?\n/).filter(l => l && !/^a=(extmap-allow-mixed|msid-semantic|ice-options)/.test(l) && !(/^a=candidate/.test(l) && !/ udp /i.test(l)));
    const raw = (desc.type === 'offer' ? 'o' : 'a') + keep.join('\n');
    const z = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    let s = ''; new Uint8Array(z).forEach(b => s += String.fromCharCode(b));
    return PREFIX + btoa(s);
  }
  async function unpack(code) {
    code = code.trim();
    if (!code.startsWith(PREFIX)) throw new Error('To nie jest kod parowania Dart');
    const bin = atob(code.slice(PREFIX.length)), u = Uint8Array.from(bin, c => c.charCodeAt(0));
    const raw = await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    return { type: raw[0] === 'o' ? 'offer' : 'answer', sdp: raw.slice(1).split('\n').join('\r\n') + '\r\n' };
  }
  function gathered() {
    return new Promise(res => {
      if (pc.iceGatheringState === 'complete') return res();
      const t = setTimeout(res, 3000);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }
  function wire(ch) {
    dc = ch;
    dc.onopen = () => onState('connected');
    dc.onclose = () => onState('disconnected');
    dc.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch {} };
  }
  async function ensureCameraPermission() { // z uprawnieniem do kamery Chrome podaje prawdziwe adresy w sieci lokalnej
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach(t => t.stop()); } catch {}
  }
  function newPc() {
    close();
    pc = new RTCPeerConnection({ iceServers: [] });
    pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) onState('disconnected'); };
  }

  // główny telefon: tworzy kod 1 (oferta)
  async function host() {
    role = 'host'; await ensureCameraPermission(); newPc();
    wire(pc.createDataChannel('dart'));
    await pc.setLocalDescription(await pc.createOffer()); await gathered();
    return pack(pc.localDescription);
  }
  async function hostAccept(code) { await pc.setRemoteDescription(await unpack(code)); }
  // druga kamera: czyta kod 1, tworzy kod 2 (odpowiedź)
  async function join(code) {
    role = 'remote'; await ensureCameraPermission(); newPc();
    pc.ondatachannel = (e) => wire(e.channel);
    const offer = await unpack(code);
    if (offer.type !== 'offer') throw new Error('To kod drugiej kamery – zeskanuj kod z głównego telefonu');
    await pc.setRemoteDescription(offer);
    await pc.setLocalDescription(await pc.createAnswer()); await gathered();
    return pack(pc.localDescription);
  }
  function send(obj) { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj)); }
  function close() { try { dc && dc.close(); } catch {} try { pc && pc.close(); } catch {} dc = null; pc = null; }

  // skaner QR (natywny BarcodeDetector w Chrome na Androidzie)
  let scanStream = null, scanTimer = null;
  const canScan = () => 'BarcodeDetector' in window;
  async function scan(videoEl) {
    const det = new BarcodeDetector({ formats: ['qr_code'] });
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    videoEl.srcObject = scanStream; await videoEl.play();
    return new Promise((res) => {
      scanTimer = setInterval(async () => {
        try {
          const codes = await det.detect(videoEl);
          const hit = codes.find(c => (c.rawValue || '').startsWith(PREFIX));
          if (hit) { stopScan(); res(hit.rawValue); }
        } catch {}
      }, 250);
    });
  }
  function stopScan() { clearInterval(scanTimer); scanTimer = null; if (scanStream) scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }

  return {
    host, hostAccept, join, send, close, scan, stopScan, canScan,
    on(m, s) { onMsg = m; onState = s; },
    get role() { return role; }, connected: () => !!(dc && dc.readyState === 'open')
  };
})();
