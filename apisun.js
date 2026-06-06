const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const os = require('os');

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
const PORT = process.env.PORT || 3001;

let apiResponseData = {
    "Phien": null,
    "Xuc_xac_1": null,
    "Xuc_xac_2": null,
    "Xuc_xac_3": null,
    "Tong": null,
    "Ket_qua": "",
    "id": "@mrtinhios",
    "server_time": new Date().toISOString()
};

let currentSessionId = null;
let lastSessionId = null;  // LƯU SESSION
let lastKnownData = null;   // LƯU KẾT QUẢ CUỐI
const patternHistory = [];

const WEBSOCKET_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
const WS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Origin": "https://play.sun.win"
};
const RECONNECT_DELAY = 1000;  // GIẢM XUỐNG 1 GIÂY
const PING_INTERVAL = 10000;    // GIẢM XUỐNG 10 GIÂY

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

let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let isReconnecting = false;

const getNetworkInfo = () => {
    let localIP = '127.0.0.1';
    try {
        const interfaces = os.networkInterfaces();
        for (const ifaceName in interfaces) {
            for (const iface of interfaces[ifaceName]) {
                if (!iface.internal && iface.family === 'IPv4') {
                    localIP = iface.address;
                    break;
                }
            }
        }
    } catch(e) {}
    return { localIP, publicIP: null };
};

function sendReconnectSession() {
    if (ws && ws.readyState === WebSocket.OPEN && lastSessionId) {
        console.log(`[🔄] Đang gửi lại session ${lastSessionId}`);
        ws.send(JSON.stringify([6, "MiniGame", "taixiuPlugin", { cmd: 1005, sid: lastSessionId }]));
    }
}

function connectWebSocket() {
    if (isReconnecting) return;
    isReconnecting = true;
    
    if (ws) {
        ws.removeAllListeners();
        ws.close();
    }

    ws = new WebSocket(WEBSOCKET_URL, { headers: WS_HEADERS });

    ws.on('open', () => {
        console.log('[✅] WebSocket connected to Sun.Win');
        isReconnecting = false;
        
        // Gửi tin nhắn khởi tạo
        initialMessages.forEach((msg, i) => {
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(msg));
                }
            }, i * 600);
        });
        
        // Nếu có session cũ, gửi lại sau 2 giây
        setTimeout(() => {
            if (lastSessionId && ws.readyState === WebSocket.OPEN) {
                console.log(`[🔄] Khôi phục session ${lastSessionId}`);
                ws.send(JSON.stringify([6, "MiniGame", "taixiuPlugin", { cmd: 1005, sid: lastSessionId }]));
            }
        }, 2000);

        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
                // Gửi heartbeat message
                ws.send(JSON.stringify([6, "MiniGame", "heartbeat", { cmd: 9999, ts: Date.now() }]));
            }
        }, PING_INTERVAL);
    });

    ws.on('pong', () => {
        console.log('[📶] Ping OK');
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (!Array.isArray(data) || typeof data[1] !== 'object') return;

            const { cmd, sid, d1, d2, d3, gBB } = data[1];

            if (cmd === 1008 && sid) {
                currentSessionId = sid;
                lastSessionId = sid;  // LƯU SESSION
                console.log(`[🎮] Session: ${sid}`);
            }

            if (cmd === 1003 && gBB) {
                if (!d1 || !d2 || !d3) return;
                
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
            console.error('[❌] Lỗi xử lý message:', e.message);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[🔌] Closed: ${code}`);
        clearInterval(pingInterval);
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY);
    });

    ws.on('error', (err) => {
        console.error(`[❌] Error: ${err.message}`);
        ws.close();
    });
}

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