package com.disasterrelief.backend.blockchain;

import java.util.Locale;

/**
 * The state-transition functions of the DisasterReliefAudit contract and the
 * selectors/event topics that identify them on-chain. Selectors and topics
 * were derived with ethers (keccak256 of the canonical signature).
 *
 * Contract RequestStatus ordinals:
 *   NONE=0, CREATED=1, APPROVED=2, ACCEPTED=3, DISPATCHED=4, IN_TRANSIT=5,
 *   ARRIVED=6, RECEIVED=7, COMPLETED=8, REJECTED=9
 */
public enum BlockchainFunction {

    CREATE_REQUEST("createRequest(bytes32,address)", "0x08471e78",
            "0x6781e39f2796d355a98b0df5f2b92c2a3620d388d11d8e4c5a0d8b83778de5c0"),
    APPROVE_REQUEST("approveRequest(bytes32)", "0x76ba6009",
            "0xaf806d07339d18adcda0efac01983ef27bd88a318640722fd75d2a9ecaf3504e"),
    ACCEPT_REQUEST("acceptRequest(bytes32)", "0xa721cd30",
            "0x633687f5335dcdc5349d34dfe8d63deb47f193eda56e872653a44c713bcc2db7"),
    ASSIGN_TRANSPORTER("assignTransporter(bytes32,address)", "0x95f20249",
            "0x0c915955b9bcc41516a0bb8c1a7602a8e2895ccc7e914df51ee4f2c2e909ba70"),
    DISPATCH_REQUEST("dispatchRequest(bytes32)", "0xa3cd8e26",
            "0x0ff83243070d100290d8b4e3539de7ad68e940b2a594016044706cc32ffaaf79"),
    MARK_IN_TRANSIT("markInTransit(bytes32)", "0x38814ac9",
            "0xe46b046b310dde96c0708b905bed7dfbda9f0f65ef5bb5d18ab0bfecc1c2f475"),
    MARK_ARRIVED("markArrived(bytes32)", "0x3fd300bd",
            "0xcd276ba607e4cfab4f07cee59d194880ae56e88df12fd4b920e5ef63c15abc92"),
    RECEIVE_REQUEST("receiveRequest(bytes32)", "0x5310f1e8",
            "0xfd607ca4a28f2ccd59e3f80f1486bdae66fbc7b22ccd6700219687d8c011fe3c"),
    COMPLETE_REQUEST("completeRequest(bytes32)", "0xac0c9c5e",
            "0xe68441aa87a7b3661c947ff0d964edf2f39120d803190af72f11a07be4bf7fc8"),
    REJECT_REQUEST("rejectRequest(bytes32)", "0x95587d03",
            "0xa24ac221eddbdc24e77a932f674275f23e6a658c852bc74a098d26330bf94034"),
    REJECT_APPROVED_REQUEST("rejectApprovedRequest(bytes32)", "0xe2548fbd",
            "0xa24ac221eddbdc24e77a932f674275f23e6a658c852bc74a098d26330bf94034"),
    GET_REQUEST("getRequest(bytes32)", "0xfb1e61ca", null);

    private final String signature;
    private final String selector;
    private final String eventTopic0;

    BlockchainFunction(String signature, String selector, String eventTopic0) {
        this.signature = signature;
        this.selector = selector.toLowerCase(Locale.ROOT);
        this.eventTopic0 = eventTopic0 == null ? null : eventTopic0.toLowerCase(Locale.ROOT);
    }

    public String signature() {
        return signature;
    }

    public String selector() {
        return selector;
    }

    public String eventTopic0() {
        return eventTopic0;
    }
}
