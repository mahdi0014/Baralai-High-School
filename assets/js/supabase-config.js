(function () {
    const SUPABASE_URL = "https://iuuwxkuwilnbxlaxrjdw.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1dXd4a3V3aWxuYnhsYXhyamR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTI5NjgsImV4cCI6MjA5NDY4ODk2OH0.ml1FLfxlz7ZgjrYXp2x-SdHvOGT-si10s5gORPa1-1w";

    if (!window.supabase) {
        console.error("Supabase CDN not loaded.");
        return;
    }

    window.bhsSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    function applyFilter(query, filter) {
        if (!filter || !filter.column) return query;
        const operator = filter.operator || "eq";
        const value = filter.value;

        if (operator === "eq") return query.eq(filter.column, value);
        if (operator === "neq") return query.neq(filter.column, value);
        if (operator === "gt") return query.gt(filter.column, value);
        if (operator === "gte") return query.gte(filter.column, value);
        if (operator === "lt") return query.lt(filter.column, value);
        if (operator === "lte") return query.lte(filter.column, value);
        if (operator === "like") return query.like(filter.column, value);
        if (operator === "ilike") return query.ilike(filter.column, value);
        if (operator === "is") return query.is(filter.column, value);
        if (operator === "in" && Array.isArray(value)) return query.in(filter.column, value);
        if (operator === "contains") return query.contains(filter.column, value);

        console.warn(`Unsupported Supabase filter operator: ${operator}. Using eq().`);
        return query.eq(filter.column, value);
    }

    /**
     * Fetch all rows from Supabase with pagination.
     * Supabase REST returns max 1000 rows per request by default. This helper
     * loads page-by-page and supports filters, ordering, and page size.
     *
     * @param {string} tableName
     * @param {string} selectColumns
     * @param {Array<{column:string, options?:object}>} orderList
     * @param {{pageSize?:number, filters?:Array<{column:string, operator?:string, value:any}>}} options
     */
    window.bhsFetchAllRows = async function bhsFetchAllRows(tableName, selectColumns, orderList, options) {
        if (!window.bhsSupabase || typeof window.bhsSupabase.from !== "function") {
            throw new Error("Supabase client is not ready.");
        }

        const pageSize = Math.min(Number((options && options.pageSize) || 1000), 1000);
        const filters = Array.isArray(options && options.filters) ? options.filters : [];
        let from = 0;
        let allRows = [];

        while (true) {
            let query = window.bhsSupabase
                .from(tableName)
                .select(selectColumns || "*")
                .range(from, from + pageSize - 1);

            filters.forEach(function (filter) {
                query = applyFilter(query, filter);
            });

            (orderList || []).forEach(function (item) {
                if (!item || !item.column) return;
                query = query.order(item.column, item.options || {});
            });

            const { data, error } = await query;
            if (error) throw error;

            const rows = Array.isArray(data) ? data : [];
            allRows = allRows.concat(rows);

            if (rows.length < pageSize) break;
            from += pageSize;
        }

        return allRows;
    };

    window.bhsSafeSetLocalJSON = function bhsSafeSetLocalJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn(`Local cache skipped for ${key}. Browser storage may be full.`, error);
            return false;
        }
    };

    window.bhsSafeGetLocalJSON = function bhsSafeGetLocalJSON(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.warn(`Local cache read failed for ${key}.`, error);
            return fallback;
        }
    };

})();
