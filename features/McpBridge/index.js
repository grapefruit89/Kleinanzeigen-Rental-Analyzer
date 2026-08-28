KAFeatureManager.register('McpBridge', () => {
    'use strict';

    // --- NATIVE WebMCP (Chrome DevTools) ---
    // If Chrome natively supports WebMCP via navigator.modelContext
    function registerNativeWebMCP() {
        const mcpContext = navigator.modelContext || document.modelContext;
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
        }
    }
    
    // Attempt registration
    try {
        registerNativeWebMCP();
    } catch(e) {
        console.error('[KA WebMCP] Failed to register native tool:', e);
    }
});
