<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>SunWin Dự Đoán - WebSocket Trực Tiếp</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body, html {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: black;
        }

        /* IFRAME TOÀN MÀN HÌNH */
        #fullscreen-frame {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            border: none;
            background: #000;
            z-index: 1;
        }

        /* MENU HÌNH TRÒN */
        .circle-menu {
            position: fixed;
            z-index: 9999;
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #0a1a25 0%, #0a2a2f 100%);
            border-radius: 50%;
            border: 2px solid #00ffcc;
            box-shadow: 0 0 15px rgba(0,255,204,0.5);
            cursor: grab;
            transition: all 0.2s ease;
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }

        .circle-menu:active { cursor: grabbing; transform: scale(0.96); }
        .circle-menu:hover { box-shadow: 0 0 25px rgba(0,255,204,0.8); }

        .menu-icon { font-size: 28px; }
        .prediction-badge {
            font-size: 11px;
            font-weight: bold;
            background: rgba(0,0,0,0.8);
            border-radius: 20px;
            padding: 2px 8px;
            margin-top: 4px;
            color: #00ffcc;
            font-family: monospace;
        }
        .ws-status {
            font-size: 8px;
            position: absolute;
            bottom: 2px;
            right: 8px;
            color: #0f0;
        }

        /* PANEL MỞ RỘNG */
        .expanded-panel {
            position: fixed;
            z-index: 9998;
            width: 340px;
            background: rgba(8, 18, 24, 0.96);
            backdrop-filter: blur(16px);
            border-radius: 24px;
            border: 1px solid #00ffccaa;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            font-family: 'Courier New', monospace;
            color: #00ffcc;
            font-size: 12px;
            overflow: hidden;
            pointer-events: auto;
        }

        .panel-header {
            background: #0a2a2f;
            padding: 10px 14px;
            font-weight: bold;
            font-size: 13px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #2faa99;
            cursor: move;
        }

        .panel-content {
            padding: 12px;
            max-height: 450px;
            overflow-y: auto;
        }

        .stats-row {
            background: #031016;
            margin: 8px 0;
            padding: 8px;
            border-radius: 12px;
            border-left: 3px solid #0ff;
        }

        .prediction-box {
            background: #021118;
            text-align: center;
            padding: 12px;
            border-radius: 20px;
            margin: 10px 0;
        }

        .prediction-value { font-size: 28px; font-weight: 800; letter-spacing: 2px; }
        button {
            background: #1a4a55;
            border: none;
            color: white;
            padding: 6px 12px;
            border-radius: 30px;
            margin-top: 8px;
            width: 100%;
            cursor: pointer;
            font-family: monospace;
            font-weight: bold;
        }
        button:hover { background: #2a6a7a; }
        .history-mini span {
            display: inline-block;
            background: #001e22;
            margin: 3px;
            padding: 3px 8px;
            border-radius: 20px;
            font-size: 11px;
        }
        .close-panel-btn, .minimize-panel-btn {
            background: #226655;
            border: none;
            color: white;
            border-radius: 20px;
            width: 26px;
            height: 26px;
            font-size: 16px;
            cursor: pointer;
        }
        .close-panel-btn { background: #aa3355; margin-left: 8px; }
        hr { border-color: #2faa9955; margin: 8px 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #031016; }
        ::-webkit-scrollbar-thumb { background: #00ffcc88; border-radius: 4px; }
    </style>
</head>
<body>

<iframe id="fullscreen-frame" src="https://web.sunwin.qa" allow="fullscreen; autoplay; clipboard-write" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-top-navigation"></iframe>

<!-- MENU HÌNH TRÒN -->
<div id="circleMenu" class="circle-menu" style="top: 80px; right: 20px;">
    <div class="menu-icon">🎲</div>
    <div class="prediction-badge" id="miniPred">---</div>
    <div class="ws-status" id="wsStatusDot">●</div>
</div>

<!-- PANEL -->
<div id="expandedPanel" class="expanded-panel" style="display: none; top: 80px; right: 110px;">
    <div class="panel-header" id="panelHeader">
        <span>🎲 SUNWIN WS TRỰC TIẾP</span>
        <div>
            <button class="minimize-panel-btn" id="minimizePanelBtn">─</button>
            <button class="close-panel-btn" id="closePanelBtn">✕</button>
        </div>
    </div>
    <div id="panelBody" class="panel-content">
        <div class="stats-row" id="currentInfo">📡 Đang kết nối WebSocket...</div>
        <div class="prediction-box">
            <div>🔮 DỰ ĐOÁN PHIÊN TIẾP THEO</div>
            <div class="prediction-value" id="nextPred">---</div>
            <div style="font-size: 9px;">thuật toán: streak + tần suất + tổng điểm</div>
        </div>
        <div class="stats-row">
            📊 THỐNG KÊ<br>
            🟢 TÀI: <span id="taiCount">0</span> &nbsp;| 🔴 XỈU: <span id="xiuCount">0</span><br>
            📜 Tổng: <span id="totalHistory">0</span> | Phiên: <span id="sessionId">---</span>
        </div>
        <button id="refreshBtn">⟳ LẤY DỮ LIỆU THỦ CÔNG</button>
        <hr>
        <div>📜 15 KQ GẦN NHẤT:</div>
        <div id="miniHistory" class="history-mini" style="margin-top: 6px;">--</div>
        <div style="font-size: 9px; text-align: center; margin-top: 10px;">💡 Kéo thả tiêu đề để di chuyển</div>
    </div>
</div>

<script>
    // ======================= UI DRAG & DROP =======================
    const circleMenu = document.getElementById('circleMenu');
    const expandedPanel = document.getElementById('expandedPanel');
    let isCircleDragging = false, circleOffsetX, circleOffsetY;

    circleMenu.addEventListener('mousedown', (e) => {
        if (e.target.closest('.circle-menu') !== circleMenu) return;
        isCircleDragging = true;
        const rect = circleMenu.getBoundingClientRect();
        circleOffsetX = e.clientX - rect.left;
        circleOffsetY = e.clientY - rect.top;
        circleMenu.style.cursor = 'grabbing';
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isCircleDragging) return;
        let newLeft = e.clientX - circleOffsetX;
        let newTop = e.clientY - circleOffsetY;
        newLeft = Math.min(window.innerWidth - circleMenu.offsetWidth - 5, Math.max(5, newLeft));
        newTop = Math.min(window.innerHeight - circleMenu.offsetHeight - 5, Math.max(5, newTop));
        circleMenu.style.left = newLeft + 'px';
        circleMenu.style.top = newTop + 'px';
        circleMenu.style.right = 'auto';
    });

    window.addEventListener('mouseup', () => { isCircleDragging = false; circleMenu.style.cursor = 'grab'; });

    circleMenu.addEventListener('click', (e) => {
        if (isCircleDragging) return;
        const rect = circleMenu.getBoundingClientRect();
        let panelLeft = rect.right + 10, panelTop = rect.top;
        if (panelLeft + 340 > window.innerWidth) panelLeft = rect.left - 350;
        if (panelTop + 500 > window.innerHeight) panelTop = window.innerHeight - 510;
        if (panelTop < 10) panelTop = 10;
        expandedPanel.style.left = panelLeft + 'px';
        expandedPanel.style.top = panelTop + 'px';
        expandedPanel.style.display = 'block';
    });

    document.getElementById('closePanelBtn').addEventListener('click', () => { expandedPanel.style.display = 'none'; });
    document.getElementById('minimizePanelBtn').addEventListener('click', () => { expandedPanel.style.display = 'none'; });

    const panelHeader = document.getElementById('panelHeader');
    let isPanelDragging = false, panelOffsetX, panelOffsetY;
    panelHeader.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('minimize-panel-btn') || e.target.classList.contains('close-panel-btn')) return;
        isPanelDragging = true;
        const rect = expandedPanel.getBoundingClientRect();
        panelOffsetX = e.clientX - rect.left;
        panelOffsetY = e.clientY - rect.top;
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isPanelDragging || expandedPanel.style.display === 'none') return;
        let newLeft = e.clientX - panelOffsetX, newTop = e.clientY - panelOffsetY;
        newLeft = Math.min(window.innerWidth - expandedPanel.offsetWidth - 5, Math.max(5, newLeft));
        newTop = Math.min(window.innerHeight - 80, Math.max(5, newTop));
        expandedPanel.style.left = newLeft + 'px';
        expandedPanel.style.top = newTop + 'px';
    });
    window.addEventListener('mouseup', () => { isPanelDragging = false; });

    // ======================= WEBSOCKET TRỰC TIẾP =======================
    let ws = null;
    let currentSession = null;
    let historyData = [];  // Lưu lịch sử [{result, total, session}]
    let lastResult = null;
    let reconnectAttempts = 0;
    let pingInterval = null;

    const WS_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
    const WS_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Origin": "https://play.sun.win"
    };

    const INIT_MESSAGES = [
        [1, "MiniGame", "GM_apivopnhaan", "WangLin", {
            "info": "{\"ipAddress\":\"113.185.45.88\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJwbGFtYW1hIiwiYm90IjowLCJpc01lcmNoYW50IjpmYWxzZSwidmVyaWZpZWRCYW5rQWNjb3VudCI6ZmFsc2UsInBsYXlFdmVudExvYmJ5IjpmYWxzZSwiY3VzdG9tZXJJZCI6MzMxNDgxMTYyLCJhZmZJZCI6IkdFTVdJTiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiZ2VtIiwidGltZXN0YW1wIjoxNzY2NDc0NzgwMDA2LCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0IjpmYWxzZSwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImlwQWRkcmVzcyI6IjExMy4xODUuNDUuODgiLCJtdXRlIjpmYWxzZSwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzE4LnBuZyIsInBsYXRmb3JtSWQiOjUsInVzZXJJZCI6IjZhOGI0ZDM4LTFlYzEtNDUxYi1hYTA1LWYyZDkwYWFhNGM1MCIsInJlZ1RpbWUiOjE3NjY0NzQ3NTEzOTEsInBob25lIjoiIiwiZGVwb3NpdCI6ZmFsc2UsInVzZXJuYW1lIjoiR01fYXBpdm9wbmhhYW4ifQ.YFOscbeojWNlRo7490BtlzkDGYmwVpnlgOoh04oCJy4\",\"locale\":\"vi\",\"userId\":\"6a8b4d38-1ec1-451b-aa05-f2d90aaa4c50\",\"username\":\"GM_apivopnhaan\",\"timestamp\":1766474780007,\"refreshToken\":\"63d5c9be0c494b74b53ba150d69039fd.7592f06d63974473b4aaa1ea849b2940\"}",
            "signature": "66772A1641AA8B18BD99207CE448EA00ECA6D8A4D457C1FF13AB092C22C8DECF0C0014971639A0FBA9984701A91FCCBE3056ABC1BE1541D1C198AA18AF3C45595AF6601F8B048947ADF8F48A9E3E074162F9BA3E6C0F7543D38BD54FD4C0A2C56D19716CC5353BBC73D12C3A92F78C833F4EFFDC4AB99E55C77AD2CDFA91E296"
        }],
        [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
        [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
    ];

    function updateUI() {
        // Cập nhật thống kê
        const taiTotal = historyData.filter(h => h.result === 'Tài').length;
        const xiuTotal = historyData.filter(h => h.result === 'Xỉu').length;
        document.getElementById('taiCount').innerText = taiTotal;
        document.getElementById('xiuCount').innerText = xiuTotal;
        document.getElementById('totalHistory').innerText = historyData.length;
        document.getElementById('sessionId').innerText = currentSession || '---';

        // Hiển thị kết quả gần nhất
        if (historyData.length > 0) {
            const last = historyData[0];
            document.getElementById('currentInfo').innerHTML = `
                🎲 PHIÊN: ${last.session}<br>
                🎲 TỔNG: ${last.total} | KQ: <strong>${last.result === 'Tài' ? '🟢 TÀI' : '🔴 XỈU'}</strong>
            `;
        }

        // Dự đoán
        if (historyData.length >= 5) {
            const prediction = calculatePrediction();
            const predElem = document.getElementById('nextPred');
            predElem.innerHTML = prediction === 'Tài' ? '🟢 TÀI ⬆️' : '🔴 XỈU ⬇️';
            predElem.style.color = prediction === 'Tài' ? '#88ffcc' : '#ffaa88';
            document.getElementById('miniPred').innerHTML = prediction === 'Tài' ? 'TÀI' : 'XỈU';
        }

        // Hiển thị lịch sử
        renderMiniHistory();
    }

    function calculatePrediction() {
        if (historyData.length < 5) return 'Tài';
        
        const last15 = historyData.slice(0, 15);
        const results = last15.map(h => h.result);
        
        // Phân tích streak
        let streak = 1;
        for (let i = 1; i < results.length; i++) {
            if (results[i] === results[i-1]) streak++;
            else break;
        }
        
        let streakPred = null;
        if (streak >= 3) streakPred = results[0] === 'Tài' ? 'Xỉu' : 'Tài';
        
        // Tần suất 12 ván
        const last12 = historyData.slice(0, 12);
        const tai12 = last12.filter(h => h.result === 'Tài').length;
        const xiu12 = last12.filter(h => h.result === 'Xỉu').length;
        const freqPred = tai12 > xiu12 ? 'Xỉu' : 'Tài';
        
        // Trung bình tổng
        let avgTotal = last12.reduce((a, h) => a + h.total, 0) / last12.length;
        const sumPred = avgTotal >= 10.5 ? 'Xỉu' : 'Tài';
        
        // Trọng số
        let scores = { 'Tài': 0, 'Xỉu': 0 };
        if (streakPred) scores[streakPred] += 0.45;
        scores[freqPred] += 0.30;
        scores[sumPred] += 0.25;
        
        return scores['Tài'] >= scores['Xỉu'] ? 'Tài' : 'Xỉu';
    }

    function renderMiniHistory() {
        const container = document.getElementById('miniHistory');
        if (historyData.length === 0) {
            container.innerHTML = '<span>CHƯA CÓ DỮ LIỆU</span>';
            return;
        }
        let html = '';
        for (let i = 0; i < Math.min(15, historyData.length); i++) {
            let item = historyData[i];
            let short = item.result === 'Tài' ? '🟢T' : '🔴X';
            html += `<span title="Phiên ${item.session} | Tổng ${item.total}">${short}</span>`;
        }
        container.innerHTML = html;
    }

    function connectWebSocket() {
        if (ws && ws.readyState === WebSocket.OPEN) return;
        
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
            console.log('✅ WebSocket đã kết nối');
            document.getElementById('wsStatusDot').style.color = '#0f0';
            document.getElementById('wsStatusDot').title = 'Đã kết nối';
            reconnectAttempts = 0;
            
            // Gửi init messages
            INIT_MESSAGES.forEach((msg, i) => {
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
                }, i * 500);
            });
            
            // Gửi ping định kỳ
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify([6, "MiniGame", "heartbeat", { cmd: 9999, ts: Date.now() }]));
                }
            }, 25000);
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!Array.isArray(data) || typeof data[1] !== 'object') return;
                
                const { cmd, sid, d1, d2, d3, gBB } = data[1];
                
                if (cmd === 1008 && sid) {
                    currentSession = sid;
                    console.log(`🎮 Session: ${sid}`);
                }
                
                if (cmd === 1003 && gBB === true && d1 && d2 && d3) {
                    const total = d1 + d2 + d3;
                    const result = total > 10 ? "Tài" : "Xỉu";
                    
                    const newResult = {
                        session: currentSession,
                        total: total,
                        result: result,
                        timestamp: Date.now()
                    };
                    
                    // Chống trùng lặp
                    if (historyData.length === 0 || historyData[0].session !== currentSession) {
                        historyData.unshift(newResult);
                        if (historyData.length > 100) historyData.pop();
                        console.log(`🎲 ${d1}-${d2}-${d3} = ${total} (${result})`);
                        updateUI();
                    }
                }
            } catch(e) { console.error('Parse error:', e); }
        };
        
        ws.onclose = () => {
            console.log('🔌 WebSocket đóng, reconnect sau 3s...');
            document.getElementById('wsStatusDot').style.color = '#f00';
            clearInterval(pingInterval);
            setTimeout(() => connectWebSocket(), 3000);
        };
        
        ws.onerror = (err) => {
            console.error('WS Error:', err);
            ws.close();
        };
    }

    // Khởi tạo
    connectWebSocket();
    document.getElementById('refreshBtn').addEventListener('click', () => { updateUI(); });
</script>
</body>
</html>