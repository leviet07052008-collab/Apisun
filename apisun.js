const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const os = require('os');
const fs = require('fs');

// ========== FIX 1: LƯU SESSION VÀO DISK ==========
const SESSION_FILE = './session_cache.json';
let lastSessionId = null;

try {
    if (fs.existsSync(SESSION_FILE)) {
        const saved = JSON.parse(fs.readFileSync(SESSION_FILE));
        lastSessionId = saved.lastSessionId;
        console.log(`[💾] Khôi phục session từ disk: ${lastSessionId}`);
    }
} catch(e) {}

// Patch network cho iSH
const originalNetworkInterfaces = os.networkInterfaces;
os.networkInterfaces = function() {
    try {
        return originalNetworkInterfaces.call(this);
    } catch(e) {
        return {
            'lo0': [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true }],
            'eth0': [{ address: '172.17.0.1', netmask: '255.255.0.0', family: 'IPv4', internal: false }]
        };
    }
};

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

let apiResponseData = {
    "Phien": null,
    "Xuc_xac_1": null,
    "Xuc_xac_2": null,
    "Xuc_xac_3": null,
    "Tong": null,
    "Ket_qua": "",
    "id": "@mrtinhios",
    "server_time": new Date().toISOString(),
    "update_count": 0
};

let currentSessionId = null;
let lastKnownData = null;
const patternHistory = [];

const WEBSOCKET_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
const WS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Origin": "https://play.sun.win",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache"
};

// ========== FIX 2: GIẢM PING XUỐNG 8 GIÂY, TĂNG TIMEOUT ==========
const PING_INTERVAL = 8000;
const HEARTBEAT_TIMEOUT = 25000;
const MAX_RECONNECT_ATTEMPTS = 20;

let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let isReconnecting = false;
let reconnectAttempts = 0;
let lastMessageTime = Date.now();
let forceReconnectTimer = null;

const initialMessages = [
    [
        1,
        "MiniGame",
        "GM_apivopnhaan",
        "WangLin",
        {
            "info": "{\"ipAddress\":\"113.185.45.88\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJwbGFtYW1hIiwiYm90IjowLCJpc01lcmNoYW50IjpmYWxzZSwidmVyaWZpZWRCYW5rQWNjb3VudCI6ZmFsc2UsInBsYXlFdmVudExvYmJ5IjpmYWxzZSwiY3VzdG9tZXJJZCI6MzMxNDgxMTYyLCJhZmZJZCI6IkdFTVdJTiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiZ2VtIiwidGltZXN0YW1wIjoxNzY2NDc0NzgwMDA2LCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0IjpmYWxzZSwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImlwQWRkcmVzcyI6IjExMy4xODUuNDUuODgiLCJtdXRlIjpmYWxzZSwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzE4LnBuZyIsInBsYXRmb3JtSWQiOjUsInVzZXJJZCI6IjZhOGI0ZDM4LTFlYzEtNDUxYi1hYTA1LWYyZDkwYWFhNGM1MCIsInJlZ1RpbWUiOjE3NjY0NzQ3NTEzOTEsInBob25lIjoiIiwiZGVwb3NpdCI6ZmFsc2UsInVzZXJuYW1lIjoiR01fYXBpdm9wbmhhYW4ifQ.YFOscbeojWNlRo7490BtlzkDGYmwVpnlgOoh04oCJy4\",\"locale\":\"vi\",\"userId\":\"6a8b4d38-1ec1-451b-aa05-f2d90aaa4c50\",\"username\":\"GM_apivopnhaan\",\"timestamp\":1766474780007,\"refreshToken\":\"63d5c9be0c494b74b53ba150d69039fd.7592f06d63974473b4aaa1ea849b2940\"}",
            "signature": "66772A1641AA8B18BD99207CE448EA00ECA6D8A4D457C1FF13AB092C22C8DECF0C0014971639A0FBA9984701A91FCCBE3056ABC1BE1541D1C198AA18AF3C45595AF6601F8B048947ADF8F48A9E3E074162F9BA3E6C0F7543D38BD54FD4C0A2C56D19716CC5353BBC73D12C3A92F78C833F4EFFDC4AB99E55C77AD2CDFA91E296"
        }
    ],
    [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
    [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

// ========== FIX 3: KIỂM TRA TIMEOUT ==========
function startHeartbeatMonitor() {
    if (forceReconnectTimer) clearInterval(forceReconnectTimer);
    forceReconnectTimer = setInterval(() => {
        const now = Date.now();
        if (ws && ws.readyState === WebSocket.OPEN && (now - lastMessageTime) > HEARTBEAT_TIMEOUT) {
            console.log('[⚠️] 25s không có dữ liệu -> force reconnect');
            try { ws.terminate(); } catch(e) {}
        }
    }, 10000);
}

// ========== FIX 4: LƯU SESSION XUỐNG DISK ==========
function saveSessionToDisk(sessionId) {
    if (sessionId) {
        fs.writeFileSync(SESSION_FILE, JSON.stringify({ lastSessionId: sessionId, savedAt: Date.now() }));
    }
}

// ========== FIX 5: EXPONENTIAL BACKOFF ==========
function getReconnectDelay() {
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
    return Math.floor(delay);
}

function connectWebSocket() {
    if (isReconnecting && reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        console.log('[⚠️] Đã đạt giới hạn reconnect, thử lại sau 60s');
        setTimeout(() => {
            reconnectAttempts = 0;
            connectWebSocket();
        }, 60000);
        return;
    }
    
    if (reconnectAttempts > 0) {
        const delay = getReconnectDelay();
        console.log(`[⏳] Thử reconnect lần ${reconnectAttempts}, chờ ${delay}ms`);
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
            isReconnecting = false;
            connectWebSocket();
        }, delay);
        return;
    }
    
    isReconnecting = true;
    reconnectAttempts++;
    
    if (ws) {
        ws.removeAllListeners();
        try { ws.terminate(); } catch(e) {}
    }

    // ========== FIX 6: THÊM OPTIONS CHỐNG NGẮT KẾT NỐI ==========
    ws = new WebSocket(WEBSOCKET_URL, { 
        headers: WS_HEADERS,
        perMessageDeflate: false,
        handshakeTimeout: 10000
    });

    ws.on('open', () => {
        console.log('[✅] WebSocket connected');
        isReconnecting = false;
        reconnectAttempts = 0;
        lastMessageTime = Date.now();
        startHeartbeatMonitor();
        
        // Gửi tin nhắn khởi tạo
        initialMessages.forEach((msg, i) => {
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(msg));
                    console.log(`[📤] Gửi init message ${i+1}`);
                }
            }, i * 400);
        });
        
        // Khôi phục session cũ
        setTimeout(() => {
            if (lastSessionId && ws && ws.readyState === WebSocket.OPEN) {
                console.log(`[🔄] Khôi phục session ${lastSessionId}`);
                ws.send(JSON.stringify([6, "MiniGame", "taixiuPlugin", { cmd: 1005, sid: lastSessionId }]));
            }
        }, 2000);

        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.ping();
                ws.send(JSON.stringify([6, "MiniGame", "heartbeat", { cmd: 9999, ts: Date.now() }]));
            }
        }, PING_INTERVAL);
    });

    ws.on('pong', () => {
        lastMessageTime = Date.now();
    });

    ws.on('message', (message) => {
        lastMessageTime = Date.now();
        try {
            const data = JSON.parse(message);
            if (!Array.isArray(data) || typeof data[1] !== 'object') return;

            const { cmd, sid, d1, d2, d3, gBB } = data[1];

            if (cmd === 1008 && sid) {
                currentSessionId = sid;
                if (lastSessionId !== sid) {
                    lastSessionId = sid;
                    saveSessionToDisk(sid);
                }
                console.log(`[🎮] Session: ${sid}`);
            }

            if (cmd === 1003 && gBB === true) {
                if (typeof d1 !== 'number' || typeof d2 !== 'number' || typeof d3 !== 'number') return;
                if (d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6 || d3 < 1 || d3 > 6) return;
                
                const total = d1 + d2 + d3;
                const result = (total > 10) ? "Tài" : "Xỉu";
                
                lastKnownData = { d1, d2, d3, total, result };
                
                apiResponseData = {
                    "Phien": currentSessionId || lastSessionId,
                    "Xuc_xac_1": d1,
                    "Xuc_xac_2": d2,
                    "Xuc_xac_3": d3,
                    "Tong": total,
                    "Ket_qua": result,
                    "id": "@leviet",
                    "server_time": new Date().toISOString(),
                    "update_count": (apiResponseData.update_count || 0) + 1
                };
                
                console.log(`[🎲] ${d1}-${d2}-${d3} = ${total} (${result})`);
                
                patternHistory.unshift({
                    session: currentSessionId || lastSessionId,
                    dice: [d1, d2, d3],
                    total: total,
                    result: result,
                    timestamp: new Date().toISOString()
                });
                
                if (patternHistory.length > 100) patternHistory.pop();
            }
        } catch (e) {
            console.error('[❌] Lỗi parse message:', e.message);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[🔌] Đóng kết nối, code: ${code}`);
        clearInterval(pingInterval);
        clearInterval(forceReconnectTimer);
        if (code !== 1000) {
            reconnectAttempts++;
            setTimeout(() => {
                isReconnecting = false;
                connectWebSocket();
            }, getReconnectDelay());
        } else {
            setTimeout(() => {
                isReconnecting = false;
                connectWebSocket();
            }, 3000);
        }
    });

    ws.on('error', (err) => {
        console.error(`[❌] Lỗi WebSocket: ${err.message}`);
        if (ws) ws.close();
    });
}

// ========== FIX 7: XỬ LÝ SIGTERM ==========
process.on('SIGTERM', () => {
    console.log('[🛑] Nhận SIGTERM, lưu session...');
    if (lastSessionId) saveSessionToDisk(lastSessionId);
    if (ws) ws.close();
    setTimeout(() => process.exit(0), 1000);
});

// API Routes
app.get('/api/ditmemaysun', (req, res) => res.json(apiResponseData));
app.get('/api/history', (req, res) => res.json({ current: apiResponseData, history: patternHistory.slice(0,20) }));
app.get('/api/stats', (req, res) => {
    const tai = patternHistory.filter(i => i.result === "Tài").length;
    const xiu = patternHistory.filter(i => i.result === "Xỉu").length;
    res.json({ total: patternHistory.length, tai, xiu, tai_percent: patternHistory.length ? (tai/patternHistory.length*100).toFixed(1) : 0 });
});
app.get('/api/health', (req, res) => res.json({ status: 'online', websocket: ws?.readyState === WebSocket.OPEN, session: lastSessionId }));

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Sun.Win Live</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>body{background:#0a0a0a;color:#0f0;font-family:monospace;padding:20px}.data{font-size:2em;font-weight:bold}.tai{color:#0f0}.xiu{color:#f00}</style>
    <script>setInterval(()=>{fetch('/api/ditmemaysun').then(r=>r.json()).then(d=>{if(d.Tong){document.getElementById('result').innerHTML=d.Xuc_xac_1+'-'+d.Xuc_xac_2+'-'+d.Xuc_xac_3+' = '+d.Tong+' ('+d.Ket_qua+')';document.getElementById('result').className='data '+(d.Ket_qua==='Tài'?'tai':'xiu');}});},3000);</script>
    </head>
    <body><h1>🔴 Sun.Win Live</h1><div id="result" class="data">Waiting...</div><p>Session: <span id="sid"></span></p>
    <script>fetch('/api/health').then(r=>r.json()).then(d=>{document.getElementById('sid').innerText=d.session||'N/A';});</script>
    <hr><a href="/api/ditmemaysun">API</a> | <a href="/api/history">History</a> | <a href="/api/stats">Stats</a></body></html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server: http://localhost:${PORT}`);
    connectWebSocket();
});