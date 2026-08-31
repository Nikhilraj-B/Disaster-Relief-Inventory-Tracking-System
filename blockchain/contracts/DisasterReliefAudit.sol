// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title DisasterReliefAudit
 * @notice Single unified contract enforcing the immutable supply chain lifecycle of
 *         the Blockchain-Based Disaster Relief Inventory Tracker.
 *
 * Design (from docs/smart-contract-design.md):
 *  - Single contract, OpenZeppelin AccessControl roles, no proxies/upgrades,
 *    no oracles, no IPFS/off-chain data on-chain.
 *  - `requestId` is a deterministic bytes32 derived from the application's
 *    SupplyRequest UUID.
 *  - Stores only the minimum critical state: requestId, actor wallets, status,
 *    updatedAt. Item-level details, strings and quantities stay off-chain.
 *  - The state machine is aggressively enforced; any transition not listed is
 *    reverted.
 *
 * Roles:
 *  - ADMIN_ROLE      : government admin (global actor)
 *  - WAREHOUSE_ROLE  : warehouse managers
 *  - CAMP_ROLE       : camp managers
 *  - TRANSPORT_ROLE  : transport officers
 */
contract DisasterReliefAudit is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant WAREHOUSE_ROLE = keccak256("WAREHOUSE_ROLE");
    bytes32 public constant CAMP_ROLE = keccak256("CAMP_ROLE");
    bytes32 public constant TRANSPORT_ROLE = keccak256("TRANSPORT_ROLE");

    enum RequestStatus {
        NONE,        // 0
        CREATED,     // 1
        APPROVED,    // 2
        ACCEPTED,    // 3
        DISPATCHED,  // 4
        IN_TRANSIT,  // 5
        ARRIVED,     // 6
        RECEIVED,    // 7
        COMPLETED,   // 8
        REJECTED     // 9
    }

    struct SupplyRequestRecord {
        bytes32 requestId;
        address campWallet;
        address warehouseWallet;
        address transporterWallet;
        RequestStatus status;
        uint256 updatedAt;
    }

    mapping(bytes32 => SupplyRequestRecord) public supplyRequests;

    event RequestCreated(bytes32 indexed requestId, address indexed campWallet, address indexed warehouseWallet, uint256 timestamp);
    event RequestApproved(bytes32 indexed requestId, address indexed actor, uint256 timestamp);
    event RequestRejected(bytes32 indexed requestId, address indexed actor, uint256 timestamp);
    event RequestAccepted(bytes32 indexed requestId, address indexed actor, uint256 timestamp);
    event TransporterAssigned(bytes32 indexed requestId, address indexed transporter, uint256 timestamp);
    event RequestDispatched(bytes32 indexed requestId, address indexed actor, uint256 timestamp);
    event RequestInTransit(bytes32 indexed requestId, address indexed actor, uint256 timestamp);
    event RequestArrived(bytes32 indexed requestId, address indexed actor, uint256 timestamp);
    event RequestReceived(bytes32 indexed requestId, address indexed actor, uint256 timestamp);
    event RequestCompleted(bytes32 indexed requestId, address indexed actor, uint256 timestamp);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    modifier validStatus(bytes32 requestId, RequestStatus expected) {
        require(supplyRequests[requestId].status == expected, "invalid current status");
        _;
    }

    /**
     * @dev CAMP_ROLE creates a request: NONE -> CREATED.
     *      Sets campWallet = msg.sender and warehouseWallet from arg.
     */
    function createRequest(bytes32 requestId, address warehouseWallet)
        external
        onlyRole(CAMP_ROLE)
        validStatus(requestId, RequestStatus.NONE)
    {
        require(warehouseWallet != address(0), "warehouse cannot be zero");
        SupplyRequestRecord storage r = supplyRequests[requestId];
        r.requestId = requestId;
        r.campWallet = msg.sender;
        r.warehouseWallet = warehouseWallet;
        r.status = RequestStatus.CREATED;
        r.updatedAt = block.timestamp;
        emit RequestCreated(requestId, msg.sender, warehouseWallet, block.timestamp);
    }

    /** @dev ADMIN_ROLE approves: CREATED -> APPROVED. */
    function approveRequest(bytes32 requestId)
        external
        onlyRole(ADMIN_ROLE)
        validStatus(requestId, RequestStatus.CREATED)
    {
        supplyRequests[requestId].status = RequestStatus.APPROVED;
        supplyRequests[requestId].updatedAt = block.timestamp;
        emit RequestApproved(requestId, msg.sender, block.timestamp);
    }

    /**
     * @dev ADMIN or WAREHOUSE rejects from CREATED or APPROVED.
     *      Warehouse caller must be the assigned warehouseWallet.
     */
    function rejectRequest(bytes32 requestId)
        external
        validStatus(requestId, RequestStatus.CREATED)
    {
        _reject(requestId);
    }

    /** @dev Overload allowing rejection from APPROVED. */
    function rejectApprovedRequest(bytes32 requestId)
        external
        validStatus(requestId, RequestStatus.APPROVED)
    {
        _reject(requestId);
    }

    function _reject(bytes32 requestId) private {
        if (hasRole(WAREHOUSE_ROLE, msg.sender)) {
            require(msg.sender == supplyRequests[requestId].warehouseWallet, "warehouse mismatch");
        } else {
            require(hasRole(ADMIN_ROLE, msg.sender), "not authorized");
        }
        supplyRequests[requestId].status = RequestStatus.REJECTED;
        supplyRequests[requestId].updatedAt = block.timestamp;
        emit RequestRejected(requestId, msg.sender, block.timestamp);
    }

    /** @dev WAREHOUSE accepts: APPROVED -> ACCEPTED. Caller must be warehouseWallet. */
    function acceptRequest(bytes32 requestId)
        external
        onlyRole(WAREHOUSE_ROLE)
        validStatus(requestId, RequestStatus.APPROVED)
    {
        require(msg.sender == supplyRequests[requestId].warehouseWallet, "warehouse mismatch");
        supplyRequests[requestId].status = RequestStatus.ACCEPTED;
        supplyRequests[requestId].updatedAt = block.timestamp;
        emit RequestAccepted(requestId, msg.sender, block.timestamp);
    }

    /** @dev WAREHOUSE assigns a transporter: ACCEPTED -> ACCEPTED (status unchanged). */
    function assignTransporter(bytes32 requestId, address transporterWallet)
        external
        onlyRole(WAREHOUSE_ROLE)
        validStatus(requestId, RequestStatus.ACCEPTED)
    {
        require(msg.sender == supplyRequests[requestId].warehouseWallet, "warehouse mismatch");
        require(transporterWallet != address(0), "transporter cannot be zero");
        supplyRequests[requestId].transporterWallet = transporterWallet;
        supplyRequests[requestId].updatedAt = block.timestamp;
        emit TransporterAssigned(requestId, transporterWallet, block.timestamp);
    }

    /** @dev TRANSPORT dispatches: ACCEPTED -> DISPATCHED. Caller must be transporterWallet. */
    function dispatchRequest(bytes32 requestId)
        external
        onlyRole(TRANSPORT_ROLE)
        validStatus(requestId, RequestStatus.ACCEPTED)
    {
        require(msg.sender == supplyRequests[requestId].transporterWallet, "transporter mismatch");
        supplyRequests[requestId].status = RequestStatus.DISPATCHED;
        supplyRequests[requestId].updatedAt = block.timestamp;
        emit RequestDispatched(requestId, msg.sender, block.timestamp);
    }

    /** @dev TRANSPORT marks in transit: DISPATCHED -> IN_TRANSIT. */
    function markInTransit(bytes32 requestId)
        external
        onlyRole(TRANSPORT_ROLE)
        validStatus(requestId, RequestStatus.DISPATCHED)
    {
        require(msg.sender == supplyRequests[requestId].transporterWallet, "transporter mismatch");
        supplyRequests[requestId].status = RequestStatus.IN_TRANSIT;
        supplyRequests[requestId].updatedAt = block.timestamp;
        emit RequestInTransit(requestId, msg.sender, block.timestamp);
    }

    /** @dev TRANSPORT marks arrived: IN_TRANSIT -> ARRIVED. */
    function markArrived(bytes32 requestId)
        external
        onlyRole(TRANSPORT_ROLE)
        validStatus(requestId, RequestStatus.IN_TRANSIT)
    {
        require(msg.sender == supplyRequests[requestId].transporterWallet, "transporter mismatch");
        supplyRequests[requestId].status = RequestStatus.ARRIVED;
        supplyRequests[requestId].updatedAt = block.timestamp;
        emit RequestArrived(requestId, msg.sender, block.timestamp);
    }

    /** @dev CAMP receives: ARRIVED -> RECEIVED. Caller must be original campWallet. */
    function receiveRequest(bytes32 requestId)
        external
        onlyRole(CAMP_ROLE)
        validStatus(requestId, RequestStatus.ARRIVED)
    {
        require(msg.sender == supplyRequests[requestId].campWallet, "camp mismatch");
        supplyRequests[requestId].status = RequestStatus.RECEIVED;
        supplyRequests[requestId].updatedAt = block.timestamp;
        emit RequestReceived(requestId, msg.sender, block.timestamp);
    }

    /** @dev CAMP completes: RECEIVED -> COMPLETED. Caller must be original campWallet. */
    function completeRequest(bytes32 requestId)
        external
        onlyRole(CAMP_ROLE)
        validStatus(requestId, RequestStatus.RECEIVED)
    {
        require(msg.sender == supplyRequests[requestId].campWallet, "camp mismatch");
        supplyRequests[requestId].status = RequestStatus.COMPLETED;
        supplyRequests[requestId].updatedAt = block.timestamp;
        emit RequestCompleted(requestId, msg.sender, block.timestamp);
    }

    /** @dev Read-only convenience getter. */
    function getRequest(bytes32 requestId)
        external
        view
        returns (
            address campWallet,
            address warehouseWallet,
            address transporterWallet,
            RequestStatus status,
            uint256 updatedAt
        )
    {
        SupplyRequestRecord storage r = supplyRequests[requestId];
        return (r.campWallet, r.warehouseWallet, r.transporterWallet, r.status, r.updatedAt);
    }
}
