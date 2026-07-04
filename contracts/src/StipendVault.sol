// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title StipendVault — wallet-enforced, custody-based spend policy (PLAN B)
/// @notice Enforcement lives here because the contract holds the funds. Nobody can pull
///         more than the on-chain policy allows — no off-chain keeper, no vault-stream you
///         buy into. This is the enforcement primitive beneath x402/MPP/ACP/AP2.
/// @dev PLAN B is delegation-slot-agnostic: it does not matter what the sender/recipient
///      EOA's EIP-7702 slot points at (e.g. Particle's Universal Account). The Universal
///      Account's job is cross-chain routing of deposits in / payouts out; the caps fire here.
contract StipendVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Policy {
        address token; // asset to disburse (address(0) == native)
        address sender; // creator / funder / controller of the rule
        address recipient; // who may pull funds
        uint256 amountPerPeriod; // max releasable per period window
        uint256 periodSeconds; // length of a period window
        uint256 totalCap; // lifetime max across all periods
        uint256 spent; // running lifetime total released
        uint256 lastPeriodStart; // start timestamp of the current period window
        uint256 periodSpent; // released within the current period window
        uint256 balance; // custodied funds currently held for this stipend
        bool revoked; // once true, no further claims; remainder refunded
    }

    /// @dev id = keccak256(abi.encode(sender, recipient, salt))
    mapping(bytes32 => Policy) private policies;

    /// @dev per-stipend approved agent addresses that may claim on the recipient's behalf
    mapping(bytes32 => mapping(address => bool)) public agentApproved;

    event StipendCreated(
        bytes32 indexed id,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amountPerPeriod,
        uint256 periodSeconds,
        uint256 totalCap
    );
    event Funded(bytes32 indexed id, address indexed from, uint256 amount);
    event Claimed(bytes32 indexed id, address indexed caller, address indexed recipient, uint256 amount);
    event Revoked(bytes32 indexed id, uint256 refund);
    event Modified(bytes32 indexed id, uint256 amountPerPeriod, uint256 periodSeconds, uint256 totalCap);
    event AgentApproved(bytes32 indexed id, address indexed agent, bool approved);

    error StipendNotFound();
    error StipendExists();
    error NotSender();
    error NotAuthorized();
    error IsRevoked();
    error ZeroAmount();
    error BadParams();
    error NativeValueMismatch();
    error UnexpectedNativeValue();
    error OverPeriodCap();
    error OverTotalCap();
    error InsufficientBalance();
    error CapBelowSpent();
    error NativeTransferFailed();

    /// @notice Compute the deterministic id for a stipend.
    function computeId(address sender, address recipient, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(sender, recipient, salt));
    }

    /// @notice Create a stipend rule and deposit the initial funding.
    /// @dev Native funding uses msg.value; ERC20 funding pulls `initialDeposit` via transferFrom.
    ///      `initialDeposit` is additive to the given 6-field rule spec so ERC20 can be funded at
    ///      creation (native ignores it and uses msg.value). Fund more later via {fund}.
    function createStipend(
        address token,
        address recipient,
        uint256 amountPerPeriod,
        uint256 periodSeconds,
        uint256 totalCap,
        bytes32 salt,
        uint256 initialDeposit
    ) external payable nonReentrant returns (bytes32 id) {
        if (recipient == address(0) || amountPerPeriod == 0 || periodSeconds == 0 || totalCap == 0) {
            revert BadParams();
        }

        id = computeId(msg.sender, recipient, salt);
        if (policies[id].sender != address(0)) revert StipendExists();

        uint256 deposit;
        if (token == address(0)) {
            deposit = msg.value;
        } else {
            if (msg.value != 0) revert UnexpectedNativeValue();
            deposit = initialDeposit;
            if (deposit > 0) {
                IERC20(token).safeTransferFrom(msg.sender, address(this), deposit);
            }
        }

        policies[id] = Policy({
            token: token,
            sender: msg.sender,
            recipient: recipient,
            amountPerPeriod: amountPerPeriod,
            periodSeconds: periodSeconds,
            totalCap: totalCap,
            spent: 0,
            lastPeriodStart: block.timestamp,
            periodSpent: 0,
            balance: deposit,
            revoked: false
        });

        emit StipendCreated(id, msg.sender, recipient, token, amountPerPeriod, periodSeconds, totalCap);
        if (deposit > 0) emit Funded(id, msg.sender, deposit);
    }

    /// @notice Add more custodied funds to an existing stipend (sender only).
    function fund(bytes32 id, uint256 amount) external payable nonReentrant {
        Policy storage p = policies[id];
        if (p.sender == address(0)) revert StipendNotFound();
        if (msg.sender != p.sender) revert NotSender();
        if (p.revoked) revert IsRevoked();
        if (amount == 0) revert ZeroAmount();

        if (p.token == address(0)) {
            if (msg.value != amount) revert NativeValueMismatch();
        } else {
            if (msg.value != 0) revert UnexpectedNativeValue();
            IERC20(p.token).safeTransferFrom(msg.sender, address(this), amount);
        }
        p.balance += amount;
        emit Funded(id, msg.sender, amount);
    }

    /// @notice THE ENFORCEMENT CORE. Release `amount` to the recipient iff every cap holds.
    /// @dev Callable by the recipient or an approved agent. Checks-effects-interactions +
    ///      nonReentrant. Period window rolls forward in whole `periodSeconds` increments.
    function claim(bytes32 id, uint256 amount) external nonReentrant {
        Policy storage p = policies[id];
        if (p.sender == address(0)) revert StipendNotFound();
        if (p.revoked) revert IsRevoked();
        if (msg.sender != p.recipient && !agentApproved[id][msg.sender]) revert NotAuthorized();
        if (amount == 0) revert ZeroAmount();

        // Period rollover: advance by whole periods so window boundaries stay aligned.
        uint256 elapsed = block.timestamp - p.lastPeriodStart;
        if (elapsed >= p.periodSeconds) {
            uint256 periods = elapsed / p.periodSeconds;
            p.lastPeriodStart += periods * p.periodSeconds;
            p.periodSpent = 0;
        }

        if (p.periodSpent + amount > p.amountPerPeriod) revert OverPeriodCap();
        if (p.spent + amount > p.totalCap) revert OverTotalCap();
        if (amount > p.balance) revert InsufficientBalance();

        p.periodSpent += amount;
        p.spent += amount;
        p.balance -= amount;

        _payout(p.token, p.recipient, amount);

        emit Claimed(id, msg.sender, p.recipient, amount);
    }

    /// @notice Revoke a stipend (sender only) and refund the remaining custodied balance.
    function revoke(bytes32 id) external nonReentrant {
        Policy storage p = policies[id];
        if (p.sender == address(0)) revert StipendNotFound();
        if (msg.sender != p.sender) revert NotSender();
        if (p.revoked) revert IsRevoked();

        p.revoked = true;
        uint256 refund = p.balance;
        p.balance = 0;
        if (refund > 0) {
            _payout(p.token, p.sender, refund);
        }
        emit Revoked(id, refund);
    }

    /// @notice Update the rule caps (sender only). Cannot set a total cap below what's spent.
    function modify(bytes32 id, uint256 newAmountPerPeriod, uint256 newPeriodSeconds, uint256 newTotalCap)
        external
    {
        Policy storage p = policies[id];
        if (p.sender == address(0)) revert StipendNotFound();
        if (msg.sender != p.sender) revert NotSender();
        if (p.revoked) revert IsRevoked();
        if (newAmountPerPeriod == 0 || newPeriodSeconds == 0) revert BadParams();
        if (newTotalCap < p.spent) revert CapBelowSpent();

        p.amountPerPeriod = newAmountPerPeriod;
        p.periodSeconds = newPeriodSeconds;
        p.totalCap = newTotalCap;
        emit Modified(id, newAmountPerPeriod, newPeriodSeconds, newTotalCap);
    }

    /// @notice Approve or revoke an agent address that may claim for the recipient (sender only).
    function approveAgent(bytes32 id, address agent, bool approved) external {
        Policy storage p = policies[id];
        if (p.sender == address(0)) revert StipendNotFound();
        if (msg.sender != p.sender) revert NotSender();
        agentApproved[id][agent] = approved;
        emit AgentApproved(id, agent, approved);
    }

    /// @notice Amount claimable right now = min(period remaining, total remaining, balance).
    function available(bytes32 id) external view returns (uint256) {
        Policy storage p = policies[id];
        if (p.sender == address(0) || p.revoked) return 0;

        uint256 periodRemaining;
        if (block.timestamp - p.lastPeriodStart >= p.periodSeconds) {
            periodRemaining = p.amountPerPeriod; // window has rolled; fresh allowance
        } else {
            periodRemaining = p.amountPerPeriod - p.periodSpent;
        }

        uint256 totalRemaining = p.totalCap - p.spent;
        uint256 cap = periodRemaining < totalRemaining ? periodRemaining : totalRemaining;
        return cap < p.balance ? cap : p.balance;
    }

    /// @notice Custodied balance currently held for a stipend.
    function balanceOf(bytes32 id) external view returns (uint256) {
        return policies[id].balance;
    }

    /// @notice Full policy struct for a stipend.
    function getPolicy(bytes32 id) external view returns (Policy memory) {
        return policies[id];
    }

    function _payout(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
