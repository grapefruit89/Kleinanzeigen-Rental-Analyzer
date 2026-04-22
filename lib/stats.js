const KAStats = {
    calculate(prices) {
        if (prices.length === 0) return null;
        const sorted = [...prices].sort((a, b) => a - b);
        const n = sorted.length;
        
        const getPercentile = (p) => {
            const pos = (n - 1) * p;
            const base = Math.floor(pos);
            const rest = pos - base;
            return sorted[base + 1] !== undefined 
                ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) 
                : sorted[base];
        };

        const q1 = getPercentile(0.25);
        const median = getPercentile(0.50);
        const q3 = getPercentile(0.75);
        const iqr = q3 - q1;
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

        return {
            q1, median, q3, iqr, avg,
            lowerFence: q1 - 1.5 * iqr,
            upperFence: q3 + 1.5 * iqr
        };
    }
};
