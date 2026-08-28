KAFeatureManager.register('McpBridge', () => {
    'use strict';

    // Wir injizieren den Code direkt in die echte Webseite (Main World),
    // da Chrome-Erweiterungen (Content Scripts) oft keinen Zugriff auf neue experimentelle navigator-APIs haben.
    const scriptCode = \
        function registerNativeWebMCP() {
            const mcpContext = navigator.modelContext || document.modelContext || window.modelContext;
            
            if (mcpContext && typeof mcpContext.registerTool === 'function') {
                console.log('[KA WebMCP] Native WebMCP API found! Registering tool...');
                mcpContext.registerTool({
                    name: 'get_kleinanzeigen_page',
                    description: 'Fetch the HTML of the currently open Kleinanzeigen tab',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                }, async (params) => {
                    console.log('[KA WebMCP] AI invoked get_kleinanzeigen_page natively');
                    return {
                        content: [{ type: 'text', text: document.documentElement.outerHTML }]
                    };
                });
                console.log('[KA WebMCP] Tool get_kleinanzeigen_page successfully registered!');
            } else {
                console.warn('[KA WebMCP] navigator.modelContext API not found in this browser context.');
            }
        }
        
        try {
            registerNativeWebMCP();
        } catch(e) {
            console.error('[KA WebMCP] Failed to register native tool:', e);
        }
    \;

    const script = document.createElement('script');
    script.textContent = scriptCode;
    (document.head || document.documentElement).appendChild(script);
    script.remove(); // Aufräumen, nachdem der Code ausgeführt wurde
});
