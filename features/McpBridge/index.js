KAFeatureManager.register('McpBridge', () => {
    'use strict';

    let ws = null;
    let isConnecting = false;
    let reconnectTimer = null;

    function connect() {
        if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) return;
        isConnecting = true;

        try {
            ws = new WebSocket('ws://localhost:8765');
        } catch (e) {
            isConnecting = false;
            scheduleReconnect();
            return;
        }

        ws.onopen = () => {
            console.log('[KA MCP Bridge] Verbunden mit lokalem MCP-Server.');
            isConnecting = false;
        };

        ws.onmessage = (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                console.error('[KA MCP Bridge] Konnte Nachricht nicht parsen:', e);
                return;
            }

            if (data.action === 'get_html') {
                ws.send(JSON.stringify({
                    type: 'page_data',
                    requestId: data.requestId,
                    html: document.documentElement.outerHTML
                }));
            }
        };

        ws.onclose = () => {
            isConnecting = false;
            scheduleReconnect();
        };

        ws.onerror = () => {
            // onclose feuert danach ohnehin; hier nur sauber schließen
            try { ws.close(); } catch (e) {}
        };
    }

    function scheduleReconnect() {
        clearTimeout(reconnectTimer);
        // Alle 5s neu versuchen -- harmlos, wenn kein lokaler Server läuft
        reconnectTimer = setTimeout(connect, 5000);
    }

    connect();
});
