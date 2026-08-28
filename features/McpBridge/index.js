KAFeatureManager.register('McpBridge', () => {
    'use strict';

    let ws = null;
    let isConnecting = false;

    function connect() {
        if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) return;
        isConnecting = true;

        ws = new WebSocket('ws://localhost:8765');

        ws.onopen = () => {
            console.log('[KA MCP Bridge] Connected to local AI server');
            isConnecting = false;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.action === 'get_html') {
                    // Send back the DOM
                    ws.send(JSON.stringify({
                        type: 'page_data',
                        html: document.documentElement.outerHTML
                    }));
                }
            } catch (e) {
                console.error('[KA MCP Bridge] Error processing message:', e);
            }
        };

        ws.onclose = () => {
            isConnecting = false;
            // Try to reconnect every 5 seconds
            setTimeout(connect, 5000);
        };

        ws.onerror = () => {
            ws.close();
        };
    }

    // Start connection attempts
    connect();
});

