// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IQuantumSwapFactory} from "../../interfaces/IQuantumSwapFactory.sol";

/// @title QuantumSwap Governance
/// @notice Governance contract for managing QuantumSwap protocol parameters
/// @dev Implements timelock and voting mechanisms for protocol upgrades
contract QuantumSwapGovernance {
    /// @notice Minimum delay for executing proposals (in seconds)
    uint256 public constant MINIMUM_DELAY = 2 days;
    
    /// @notice Maximum delay for executing proposals (in seconds)
    uint256 public constant MAXIMUM_DELAY = 30 days;
    
    /// @notice Grace period for executing proposals (in seconds)
    uint256 public constant GRACE_PERIOD = 7 days;
    
    /// @notice Minimum voting period (in seconds)
    uint256 public constant MINIMUM_VOTING_PERIOD = 3 days;
    
    /// @notice Maximum voting period (in seconds)
    uint256 public constant MAXIMUM_VOTING_PERIOD = 14 days;

    /// @notice Proposal states
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    /// @notice Proposal structure
    struct Proposal {
        uint256 id;
        address proposer;
        address[] targets;
        uint256[] values;
        string[] signatures;
        bytes[] calldatas;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        bool canceled;
        bool executed;
        uint256 eta;
    }

    /// @notice Vote structure
    struct Receipt {
        bool hasVoted;
        bool support;
        uint256 votes;
    }

    /// @notice Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        uint256 startBlock,
        uint256 endBlock,
        string description
    );

    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        bool support,
        uint256 votes
    );

    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);

    /// @notice Address of the QuantumSwap Factory
    address public immutable factory;
    
    /// @notice Address of the governance token
    address public immutable governanceToken;
    
    /// @notice Timelock delay
    uint256 public delay;
    
    /// @notice Admin address (can be changed via governance)
    address public admin;
    
    /// @notice Pending admin address
    address public pendingAdmin;

    /// @notice Proposal counter
    uint256 public proposalCount;
    
    /// @notice Voting period
    uint256 public votingPeriod;
    
    /// @notice Voting delay
    uint256 public votingDelay;

    /// @notice Proposals mapping
    mapping(uint256 => Proposal) public proposals;
    
    /// @notice Vote receipts mapping
    mapping(uint256 => mapping(address => Receipt)) public receipts;
    
    /// @notice Latest proposal by proposer
    mapping(address => uint256) public latestProposalIds;

    /// @notice Modifier to restrict access to admin only
    modifier onlyAdmin() {
        require(msg.sender == admin, "GOVERNANCE: NOT_ADMIN");
        _;
    }

    /// @notice Modifier to restrict access to timelock only
    modifier onlyTimelock() {
        require(msg.sender == address(this), "GOVERNANCE: NOT_TIMELOCK");
        _;
    }

    /// @notice Constructor
    /// @param _factory Address of the QuantumSwap Factory
    /// @param _governanceToken Address of the governance token
    /// @param _admin Initial admin address
    /// @param _delay Initial timelock delay
    constructor(
        address _factory,
        address _governanceToken,
        address _admin,
        uint256 _delay
    ) {
        require(_factory != address(0), "GOVERNANCE: ZERO_FACTORY");
        require(_governanceToken != address(0), "GOVERNANCE: ZERO_TOKEN");
        require(_admin != address(0), "GOVERNANCE: ZERO_ADMIN");
        require(_delay >= MINIMUM_DELAY && _delay <= MAXIMUM_DELAY, "GOVERNANCE: INVALID_DELAY");

        factory = _factory;
        governanceToken = _governanceToken;
        admin = _admin;
        delay = _delay;
        votingPeriod = 3 days;
        votingDelay = 1 days;
    }

    /// @notice Propose a new governance action
    /// @param targets Array of target addresses
    /// @param values Array of ETH values
    /// @param signatures Array of function signatures
    /// @param calldatas Array of calldata
    /// @param description Description of the proposal
    /// @return proposalId The ID of the created proposal
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256 proposalId) {
        require(
            getPriorVotes(msg.sender, block.number - 1) >= getProposalThreshold(),
            "GOVERNANCE: INSUFFICIENT_VOTES"
        );

        require(
            targets.length == values.length &&
            targets.length == signatures.length &&
            targets.length == calldatas.length,
            "GOVERNANCE: ARRAY_LENGTH_MISMATCH"
        );

        require(targets.length > 0, "GOVERNANCE: EMPTY_PROPOSAL");

        uint256 latestProposalId = latestProposalIds[msg.sender];
        if (latestProposalId != 0) {
            ProposalState proposersLatestProposalState = state(latestProposalId);
            require(
                proposersLatestProposalState != ProposalState.Active,
                "GOVERNANCE: ACTIVE_PROPOSAL_EXISTS"
            );
            require(
                proposersLatestProposalState != ProposalState.Pending,
                "GOVERNANCE: PENDING_PROPOSAL_EXISTS"
            );
        }

        uint256 startBlock = block.number + votingDelay;
        uint256 endBlock = startBlock + votingPeriod;

        proposalId = proposalCount + 1;
        proposalCount = proposalId;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            targets: targets,
            values: values,
            signatures: signatures,
            calldatas: calldatas,
            startBlock: startBlock,
            endBlock: endBlock,
            forVotes: 0,
            againstVotes: 0,
            canceled: false,
            executed: false,
            eta: 0
        });

        latestProposalIds[msg.sender] = proposalId;

        emit ProposalCreated(
            proposalId,
            msg.sender,
            targets,
            values,
            signatures,
            calldatas,
            startBlock,
            endBlock,
            description
        );

        return proposalId;
    }

    /// @notice Cast a vote on a proposal
    /// @param proposalId The ID of the proposal
    /// @param support True for support, false for against
    function castVote(uint256 proposalId, bool support) public {
        return _castVote(msg.sender, proposalId, support);
    }

    /// @notice Execute a proposal
    /// @param proposalId The ID of the proposal to execute
    function execute(uint256 proposalId) public payable {
        require(state(proposalId) == ProposalState.Queued, "GOVERNANCE: PROPOSAL_NOT_QUEUED");
        
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            _executeTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i]
            );
        }

        emit ProposalExecuted(proposalId);
    }

    /// @notice Cancel a proposal
    /// @param proposalId The ID of the proposal to cancel
    function cancel(uint256 proposalId) public {
        ProposalState proposalState = state(proposalId);
        require(proposalState != ProposalState.Executed, "GOVERNANCE: PROPOSAL_EXECUTED");

        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer ||
            getPriorVotes(proposal.proposer, block.number - 1) < getProposalThreshold(),
            "GOVERNANCE: CANNOT_CANCEL"
        );

        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    /// @notice Get the state of a proposal
    /// @param proposalId The ID of the proposal
    /// @return The current state of the proposal
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(proposalCount >= proposalId, "GOVERNANCE: INVALID_PROPOSAL_ID");
        
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (block.number <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (proposal.forVotes <= proposal.againstVotes || proposal.forVotes < getQuorumVotes()) {
            return ProposalState.Defeated;
        } else if (proposal.eta == 0) {
            return ProposalState.Succeeded;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (block.timestamp >= proposal.eta + GRACE_PERIOD) {
            return ProposalState.Expired;
        } else {
            return ProposalState.Queued;
        }
    }

    /// @notice Get the number of votes required for a proposal to pass
    /// @return The number of votes required
    function getQuorumVotes() public pure returns (uint256) {
        return 1000000e18; // 1M tokens (assuming 18 decimals)
    }

    /// @notice Get the number of votes required to create a proposal
    /// @return The number of votes required
    function getProposalThreshold() public pure returns (uint256) {
        return 100000e18; // 100K tokens (assuming 18 decimals)
    }

    /// @notice Get the prior votes of an account
    /// @return The number of votes
    function getPriorVotes(address /* account */, uint256 /* blockNumber */) public pure returns (uint256) {
        // This would need to be implemented with a snapshot mechanism
        // For now, return a placeholder
        return 0;
    }

    /// @notice Internal function to cast a vote
    /// @param voter The voter address
    /// @param proposalId The proposal ID
    /// @param support True for support, false for against
    function _castVote(
        address voter,
        uint256 proposalId,
        bool support
    ) internal {
        require(state(proposalId) == ProposalState.Active, "GOVERNANCE: VOTING_CLOSED");
        
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = receipts[proposalId][voter];
        
        require(receipt.hasVoted == false, "GOVERNANCE: ALREADY_VOTED");
        
        uint256 votes = getPriorVotes(voter, proposal.startBlock);
        require(votes > 0, "GOVERNANCE: NO_VOTES");

        if (support) {
            proposal.forVotes = proposal.forVotes + votes;
        } else {
            proposal.againstVotes = proposal.againstVotes + votes;
        }

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;

        emit VoteCast(voter, proposalId, support, votes);
    }

    /// @notice Internal function to execute a transaction
    /// @param target The target address
    /// @param value The ETH value
    /// @param signature The function signature
    /// @param data The calldata
    function _executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data
    ) internal {
        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        (bool success, bytes memory returnData) = target.call{value: value}(callData);
        require(success, "GOVERNANCE: EXECUTION_FAILED");
    }

    /// @notice Set the pending admin
    /// @param newPendingAdmin The new pending admin address
    function setPendingAdmin(address newPendingAdmin) public onlyTimelock {
        pendingAdmin = newPendingAdmin;
    }

    /// @notice Accept the admin role
    function acceptAdmin() public {
        require(msg.sender == pendingAdmin, "GOVERNANCE: NOT_PENDING_ADMIN");
        admin = pendingAdmin;
        pendingAdmin = address(0);
    }

    /// @notice Set the voting delay
    /// @param newVotingDelay The new voting delay
    function setVotingDelay(uint256 newVotingDelay) public onlyTimelock {
        require(
            newVotingDelay >= 1 days && newVotingDelay <= 7 days,
            "GOVERNANCE: INVALID_VOTING_DELAY"
        );
        votingDelay = newVotingDelay;
    }

    /// @notice Set the voting period
    /// @param newVotingPeriod The new voting period
    function setVotingPeriod(uint256 newVotingPeriod) public onlyTimelock {
        require(
            newVotingPeriod >= MINIMUM_VOTING_PERIOD && newVotingPeriod <= MAXIMUM_VOTING_PERIOD,
            "GOVERNANCE: INVALID_VOTING_PERIOD"
        );
        votingPeriod = newVotingPeriod;
    }

    /// @notice Set the timelock delay
    /// @param newDelay The new delay
    function setDelay(uint256 newDelay) public onlyTimelock {
        require(
            newDelay >= MINIMUM_DELAY && newDelay <= MAXIMUM_DELAY,
            "GOVERNANCE: INVALID_DELAY"
        );
        delay = newDelay;
    }
}
