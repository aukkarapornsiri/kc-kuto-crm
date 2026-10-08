# KC CuTo CRM Inventory API v1

Endpoint: `https://tocsxnprspiogawignib.supabase.co/functions/v1/crm-inventory-api`

GET only. Send `Authorization: Bearer <CRM user access token>`. The token is validated on every request; CRM permissions and database row policies apply. Do not send service-role credentials to a browser or another application. No new shared API key has been issued.

Query: `resource=items|warehouses|balances`, `limit=1..500` (default 100), `offset=0` (default). Follow `nextOffset` until null. No automatic synchronization or writes are enabled.

Response: `{service:"kc-cuto-inventory",version:1,resource,source:"KC CuTo CRM",mode:"read-only",items:[],nextOffset:null,canSeeCost:false,fetchedAt:"ISO timestamp"}`.

Item mapping matches the prior Account 360 catalog field names: `id`, `code`, `name`, `description`, `category:PRODUCT`, `status`, `updatedAt`, `metadata.unit`, `categoryName`, `brandName`, `partNumber`, `barcode`, `salePrice`, `purchasePrice` (authorized only), `vatMode`, `inventoryControl`, `serialNumberControl`, and subscription fields. Prices are numeric THB values; VAT mode is exclusive/inclusive/exempt. IDs are CRM IDs, not Account 360 IDs. Match products using a reviewed code mapping, never by name alone.

Warehouses: id, code, name, address, active, updated_at.
Balances: id, item_id, warehouse_id, quantity, serial_number. Join item_id and warehouse_id to the corresponding CRM IDs. Balances may have multiple serial rows; do not overwrite them by item alone.

Errors: 400 invalid query, 401 invalid/missing token, 403 no access, 405 unsupported method, 502 data unavailable. Responses are never cached.

KC Account 360 direct catalog import, legacy export, and quotation push are disconnected. Existing CRM records and historical sync IDs remain intact. To integrate later, the receiving Account 360 application must implement this v1 contract and obtain an authorized CRM identity. End-to-end synchronization with Account 360 is not enabled or claimed by this release.
