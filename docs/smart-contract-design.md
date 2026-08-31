# Smart Contract Architecture Design
**Blockchain-Based Disaster Relief Inventory Tracker**

## 1. Architectural Analysis: Single-Contract Design

For this academic project, the architecture uses a **single, unified smart contract** named `DisasterReliefAudit.sol`. 

*   **Design Choice:** The contract relies on OpenZeppelin's `AccessControl` for role management. 
*   **Constraints Kept Simple:** We explicitly avoid introducing unnecessary technologies. There are no proxy contracts, no upgradeable patterns, no separate module contracts (like inventory or shipment), no oracles, and no IPFS integrations. A single contract minimizes complexity and cross-contract gas costs while fulfilling all academic verification requirements.

---

## 2. IPFS UUID ↔ Ethereum Identifier

The application's operational store (IPFS) uses standard UUIDs as primary keys for `SupplyRequest`.

To efficiently map this to Ethereum, the contract does **not** convert a UUID directly to a `uint256` or string. Instead, the contract uses:
```solidity
bytes32 requestId;
```
The application derives a deterministic `bytes32` identifier from the IPFS `SupplyRequest` UUID for use on-chain. 
*   **IPFS store** continues using `UUID`.
*   **Ethereum** uses `bytes32 requestId`.
*   The IPFS store saves the transaction hash (`txHash`) purely as a reference to the corresponding Ethereum transaction.

---

## 3. Data Structures & State Variables

### 3.1 Enums
```solidity
enum RequestStatus {
    NONE,
    CREATED,
    APPROVED,
    ACCEPTED,
    DISPATCHED,
    IN_TRANSIT,
    ARRIVED,
    RECEIVED,
    COMPLETED,
    REJECTED
}
```

### 3.2 Structs
```solidity
struct SupplyRequestRecord {
    bytes32 requestId;
    address campWallet;
    address warehouseWallet;
    address transporterWallet;
    RequestStatus status;
    uint256 updatedAt;
}
```

### 3.3 State Variables
*   `mapping(bytes32 => SupplyRequestRecord) public supplyRequests;`
*   OpenZeppelin Role Constants: `ADMIN_ROLE`, `WAREHOUSE_ROLE`, `CAMP_ROLE`, `TRANSPORT_ROLE`.

---

## 4. Explicit State Machine & Valid Transitions

The smart contract aggressively enforces the lifecycle of a request. 
**Valid Transitions:**
*   `NONE -> CREATED`
*   `CREATED -> APPROVED`
*   `CREATED -> REJECTED`
*   `APPROVED -> ACCEPTED`
*   `APPROVED -> REJECTED`
*   `ACCEPTED -> DISPATCHED`
*   `DISPATCHED -> IN_TRANSIT`
*   `IN_TRANSIT -> ARRIVED`
*   `ARRIVED -> RECEIVED`
*   `RECEIVED -> COMPLETED`

Any transition not explicitly listed above (e.g., `CREATED -> RECEIVED`, `REJECTED -> DISPATCHED`) is considered invalid and will be **rejected** by the contract.

---

## 5. Functions, Roles, and Actor Authorization

The contract enforces security on two levels:
1.  **Blockchain Role:** The caller must hold the correct OpenZeppelin role.
2.  **Actor Assignment:** The `msg.sender` must mathematically match the specific wallet address assigned to that request.

### Function Set

| Function | Required Role | Required Status | New Status | Validation Checks |
| :--- | :--- | :--- | :--- | :--- |
| `createRequest(bytes32, address)` | `CAMP_ROLE` | `NONE` | `CREATED` | Sets `campWallet` to `msg.sender`. Sets `warehouseWallet` to the provided address. |
| `approveRequest(bytes32)` | `ADMIN_ROLE` | `CREATED` | `APPROVED` | N/A (Admin is global). |
| `rejectRequest(bytes32)` | `ADMIN_ROLE` / `WAREHOUSE_ROLE` | `CREATED`, `APPROVED` | `REJECTED` | If caller is Warehouse, `msg.sender` must equal `warehouseWallet`. |
| `acceptRequest(bytes32)` | `WAREHOUSE_ROLE` | `APPROVED` | `ACCEPTED` | `msg.sender` must equal `warehouseWallet`. |
| `assignTransporter(bytes32, address)` | `WAREHOUSE_ROLE` | `ACCEPTED` | `ACCEPTED` | `msg.sender` must equal `warehouseWallet`. Sets `transporterWallet`. |
| `dispatchRequest(bytes32)` | `TRANSPORT_ROLE` | `ACCEPTED` | `DISPATCHED` | `msg.sender` must equal assigned `transporterWallet`. |
| `markInTransit(bytes32)` | `TRANSPORT_ROLE` | `DISPATCHED` | `IN_TRANSIT` | `msg.sender` must equal assigned `transporterWallet`. |
| `markArrived(bytes32)` | `TRANSPORT_ROLE` | `IN_TRANSIT` | `ARRIVED` | `msg.sender` must equal assigned `transporterWallet`. |
| `receiveRequest(bytes32)` | `CAMP_ROLE` | `ARRIVED` | `RECEIVED` | `msg.sender` must equal original `campWallet`. |
| `completeRequest(bytes32)` | `CAMP_ROLE` | `RECEIVED` | `COMPLETED` | `msg.sender` must equal original `campWallet`. |

---

## 6. Backend Transaction Verification

In keeping with the Web2 + Web3 hybrid architecture, the contract relies on a strict verification workflow. 
**A transaction hash supplied by the frontend must NEVER be treated as proof by itself.**

**Workflow:**
1. React -> MetaMask -> Ethereum/Hardhat
2. Transaction Confirmation
3. React sends transaction hash to Spring Boot
4. **Spring Boot independently verifies the transaction against the blockchain**
5. Only after successful verification does IPFS update the corresponding operational state.

**The Backend Must Verify At Minimum:**
*   Transaction exists
*   Transaction succeeded
*   Correct network/chain ID
*   Correct smart-contract address
*   Correct function/event
*   Correct `requestId`
*   Correct actor wallet
*   Expected state transition occurred
*   Transaction was actually included/confirmed on-chain

---

## 7. Gas Considerations

*   **Persistent contract storage is more expensive than emitting events.** Therefore, the contract stores only the minimum critical state required for enforcement and verification (`bytes32` ID, addresses, and enum status).
*   **Off-chain Item-Level Information:** Large strings, arrays, item names, categories, and item/inventory quantities are kept entirely off-chain.
*   **Events:** Events are used for historical auditability, as logging events consumes significantly less gas than maintaining arrays in contract state.

---

## 8. On-Chain vs Off-Chain Responsibility

| Data/Action | IPFS | Ethereum | Reason |
| :--- | :--- | :--- | :--- |
| **User authentication** | Yes | No | Privacy, block size, unnecessary on-chain logic. |
| **Application roles** | Yes | No | Controls Web2 UI/REST API access. |
| **Inventory** | Yes | No | High-frequency CRUD operations are too slow/expensive for blockchain. |
| **ML classification** | Yes | No | Analytical decision-support metrics, not an immutable state transition. |
| **Supply request metadata** | Yes | No | Item lists, descriptions, and string names belong in the IPFS store. |
| **Critical workflow status** | No | Yes | The immutable enforcement of the supply chain lifecycle. |
| **Critical timestamps** | No | Yes | Immutable timestamping of state changes (Dispatch, Receipt). |
| **Wallet addresses** | Yes | Yes | IPFS links user identity to wallet. Eth enforces wallet authorization (`msg.sender`). |
| **Transaction hashes** | Yes | No | Stored on IPFS strictly as untrusted references to the Eth chain. |
| **Blockchain events** | No | Yes | Cheap, immutable logs of critical actions for independent auditing. |
