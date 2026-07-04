// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {StipendVault} from "../src/StipendVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

/// @dev Native recipient that attempts to re-enter claim() during its receive().
contract ReentrantRecipient {
    StipendVault public vault;
    bytes32 public id;
    uint256 public amount;
    bool public armed;

    constructor(StipendVault _vault) {
        vault = _vault;
    }

    function attack(bytes32 _id, uint256 _amount) external {
        id = _id;
        amount = _amount;
        armed = true;
        vault.claim(_id, _amount);
    }

    receive() external payable {
        if (armed) {
            armed = false;
            vault.claim(id, amount); // should hit ReentrancyGuard and revert
        }
    }
}

contract StipendVaultTest is Test {
    StipendVault vault;
    MockUSDC usdc;

    address sender = makeAddr("sender");
    address recipient = makeAddr("recipient");
    address agent = makeAddr("agent");
    address stranger = makeAddr("stranger");

    bytes32 constant SALT = keccak256("stipend-1");

    uint256 constant PER_PERIOD = 100e6; // 100 USDC
    uint256 constant PERIOD = 7 days;
    uint256 constant TOTAL_CAP = 1_000e6; // 1000 USDC
    uint256 constant DEPOSIT = 500e6; // 500 USDC custodied

    function setUp() public {
        vault = new StipendVault();
        usdc = new MockUSDC();
        usdc.mint(sender, 1_000_000e6);
        vm.warp(1_000_000); // non-zero base timestamp
    }

    // ---- helpers ----------------------------------------------------------

    function _createUsdc() internal returns (bytes32 id) {
        vm.startPrank(sender);
        usdc.approve(address(vault), type(uint256).max);
        id = vault.createStipend(address(usdc), recipient, PER_PERIOD, PERIOD, TOTAL_CAP, SALT, DEPOSIT);
        vm.stopPrank();
    }

    // ---- creation & funding ----------------------------------------------

    function test_create_recordsPolicyAndDeposit() public {
        bytes32 id = _createUsdc();
        StipendVault.Policy memory p = vault.getPolicy(id);
        assertEq(p.token, address(usdc));
        assertEq(p.sender, sender);
        assertEq(p.recipient, recipient);
        assertEq(p.amountPerPeriod, PER_PERIOD);
        assertEq(p.periodSeconds, PERIOD);
        assertEq(p.totalCap, TOTAL_CAP);
        assertEq(p.balance, DEPOSIT);
        assertEq(p.spent, 0);
        assertFalse(p.revoked);
        assertEq(vault.balanceOf(id), DEPOSIT);
        assertEq(usdc.balanceOf(address(vault)), DEPOSIT);
    }

    function test_create_duplicateReverts() public {
        _createUsdc();
        vm.startPrank(sender);
        vm.expectRevert(StipendVault.StipendExists.selector);
        vault.createStipend(address(usdc), recipient, PER_PERIOD, PERIOD, TOTAL_CAP, SALT, DEPOSIT);
        vm.stopPrank();
    }

    function test_create_badParamsRevert() public {
        vm.startPrank(sender);
        vm.expectRevert(StipendVault.BadParams.selector);
        vault.createStipend(address(usdc), address(0), PER_PERIOD, PERIOD, TOTAL_CAP, SALT, 0);
        vm.expectRevert(StipendVault.BadParams.selector);
        vault.createStipend(address(usdc), recipient, 0, PERIOD, TOTAL_CAP, SALT, 0);
        vm.expectRevert(StipendVault.BadParams.selector);
        vault.createStipend(address(usdc), recipient, PER_PERIOD, 0, TOTAL_CAP, SALT, 0);
        vm.expectRevert(StipendVault.BadParams.selector);
        vault.createStipend(address(usdc), recipient, PER_PERIOD, PERIOD, 0, SALT, 0);
        vm.stopPrank();
    }

    function test_fund_addsBalance_senderOnly() public {
        bytes32 id = _createUsdc();
        vm.prank(sender);
        vault.fund(id, 200e6);
        assertEq(vault.balanceOf(id), DEPOSIT + 200e6);

        vm.prank(stranger);
        vm.expectRevert(StipendVault.NotSender.selector);
        vault.fund(id, 1e6);
    }

    // ---- claim happy path -------------------------------------------------

    function test_claim_happyPath() public {
        bytes32 id = _createUsdc();
        vm.prank(recipient);
        vault.claim(id, 60e6);

        assertEq(usdc.balanceOf(recipient), 60e6);
        StipendVault.Policy memory p = vault.getPolicy(id);
        assertEq(p.spent, 60e6);
        assertEq(p.periodSpent, 60e6);
        assertEq(p.balance, DEPOSIT - 60e6);
        assertEq(vault.available(id), 40e6); // 100 period cap - 60 spent this period
    }

    function test_claim_agentCanClaim() public {
        bytes32 id = _createUsdc();
        vm.prank(sender);
        vault.approveAgent(id, agent, true);

        vm.prank(agent);
        vault.claim(id, 25e6);
        assertEq(usdc.balanceOf(recipient), 25e6); // funds always go to recipient
    }

    // ---- claim enforcement reverts ---------------------------------------

    function test_claim_overPeriodCapReverts() public {
        bytes32 id = _createUsdc();
        vm.startPrank(recipient);
        vault.claim(id, 80e6);
        vm.expectRevert(StipendVault.OverPeriodCap.selector);
        vault.claim(id, 30e6); // 80 + 30 > 100 period cap
        vm.stopPrank();
    }

    function test_claim_overTotalCapReverts() public {
        // period cap high, total cap low, so total cap is the binding constraint
        vm.startPrank(sender);
        usdc.approve(address(vault), type(uint256).max);
        bytes32 id =
            vault.createStipend(address(usdc), recipient, 1_000e6, PERIOD, 150e6, keccak256("total"), 1_000e6);
        vm.stopPrank();

        vm.startPrank(recipient);
        vault.claim(id, 100e6); // period ok, total ok
        vm.warp(block.timestamp + PERIOD); // fresh period so period cap won't bind
        vm.expectRevert(StipendVault.OverTotalCap.selector);
        vault.claim(id, 100e6); // 200 > 150 total cap
        vm.stopPrank();
    }

    function test_claim_insufficientBalanceReverts() public {
        // fund below the period cap so balance is the binding constraint
        vm.startPrank(sender);
        usdc.approve(address(vault), type(uint256).max);
        bytes32 id = vault.createStipend(address(usdc), recipient, PER_PERIOD, PERIOD, TOTAL_CAP, keccak256("low"), 50e6);
        vm.stopPrank();

        vm.prank(recipient);
        vm.expectRevert(StipendVault.InsufficientBalance.selector);
        vault.claim(id, 60e6); // 60 <= period cap and total cap, but > 50 balance
    }

    function test_claim_zeroAmountReverts() public {
        bytes32 id = _createUsdc();
        vm.prank(recipient);
        vm.expectRevert(StipendVault.ZeroAmount.selector);
        vault.claim(id, 0);
    }

    function test_claim_byNonRecipientNonAgentReverts() public {
        bytes32 id = _createUsdc();
        vm.prank(stranger);
        vm.expectRevert(StipendVault.NotAuthorized.selector);
        vault.claim(id, 10e6);
    }

    function test_claim_revokedReverts() public {
        bytes32 id = _createUsdc();
        vm.prank(sender);
        vault.revoke(id);
        vm.prank(recipient);
        vm.expectRevert(StipendVault.IsRevoked.selector);
        vault.claim(id, 10e6);
    }

    // ---- period rollover --------------------------------------------------

    function test_periodRollover_resetsCorrectly() public {
        bytes32 id = _createUsdc();
        vm.startPrank(recipient);
        vault.claim(id, 100e6); // exhaust the period
        vm.expectRevert(StipendVault.OverPeriodCap.selector);
        vault.claim(id, 1e6);

        vm.warp(block.timestamp + PERIOD); // roll to next period
        vault.claim(id, 100e6); // full allowance available again
        vm.stopPrank();

        StipendVault.Policy memory p = vault.getPolicy(id);
        assertEq(p.periodSpent, 100e6);
        assertEq(p.spent, 200e6);
    }

    function test_periodRollover_alignsToWholePeriods() public {
        bytes32 id = _createUsdc();
        uint256 start = vault.getPolicy(id).lastPeriodStart;

        vm.prank(recipient);
        vault.claim(id, 10e6);

        // jump 2.5 periods forward; window should advance by exactly 2 periods
        vm.warp(start + (PERIOD * 5) / 2);
        vm.prank(recipient);
        vault.claim(id, 10e6);

        StipendVault.Policy memory p = vault.getPolicy(id);
        assertEq(p.lastPeriodStart, start + 2 * PERIOD);
        assertEq(p.periodSpent, 10e6); // reset then this claim
    }

    // ---- revoke -----------------------------------------------------------

    function test_revoke_refundsRemainder() public {
        bytes32 id = _createUsdc();
        vm.prank(recipient);
        vault.claim(id, 100e6);

        uint256 senderBalBefore = usdc.balanceOf(sender);
        vm.prank(sender);
        vault.revoke(id);

        assertEq(usdc.balanceOf(sender), senderBalBefore + (DEPOSIT - 100e6));
        StipendVault.Policy memory p = vault.getPolicy(id);
        assertTrue(p.revoked);
        assertEq(p.balance, 0);
        assertEq(vault.available(id), 0);
    }

    function test_revoke_senderOnly() public {
        bytes32 id = _createUsdc();
        vm.prank(stranger);
        vm.expectRevert(StipendVault.NotSender.selector);
        vault.revoke(id);
    }

    // ---- modify -----------------------------------------------------------

    function test_modify_updatesCaps() public {
        bytes32 id = _createUsdc();
        vm.prank(sender);
        vault.modify(id, 200e6, 1 days, 2_000e6);
        StipendVault.Policy memory p = vault.getPolicy(id);
        assertEq(p.amountPerPeriod, 200e6);
        assertEq(p.periodSeconds, 1 days);
        assertEq(p.totalCap, 2_000e6);
    }

    function test_modify_byNonSenderReverts() public {
        bytes32 id = _createUsdc();
        vm.prank(stranger);
        vm.expectRevert(StipendVault.NotSender.selector);
        vault.modify(id, 200e6, 1 days, 2_000e6);
    }

    function test_modify_capBelowSpentReverts() public {
        bytes32 id = _createUsdc();
        vm.prank(recipient);
        vault.claim(id, 100e6);
        vm.prank(sender);
        vm.expectRevert(StipendVault.CapBelowSpent.selector);
        vault.modify(id, 100e6, PERIOD, 50e6); // 50 < 100 spent
    }

    // ---- native asset -----------------------------------------------------

    function test_native_createClaimRevoke() public {
        vm.deal(sender, 10 ether);
        vm.prank(sender);
        bytes32 id = vault.createStipend{value: 5 ether}(
            address(0), recipient, 2 ether, PERIOD, 8 ether, keccak256("native"), 0
        );
        assertEq(vault.balanceOf(id), 5 ether);

        vm.prank(recipient);
        vault.claim(id, 2 ether);
        assertEq(recipient.balance, 2 ether);

        uint256 senderBalBefore = sender.balance;
        vm.prank(sender);
        vault.revoke(id);
        assertEq(sender.balance, senderBalBefore + 3 ether); // 5 - 2 claimed
    }

    // ---- reentrancy -------------------------------------------------------

    function test_reentrancyGuardHolds() public {
        ReentrantRecipient attacker = new ReentrantRecipient(vault);
        vm.deal(sender, 10 ether);
        vm.prank(sender);
        bytes32 id = vault.createStipend{value: 5 ether}(
            address(0), address(attacker), 2 ether, PERIOD, 8 ether, keccak256("reentry"), 0
        );

        // The reentrant call inside receive() trips ReentrancyGuard, which bubbles up and
        // fails the native transfer, reverting the whole claim. No double-spend possible.
        vm.expectRevert();
        attacker.attack(id, 2 ether);

        // State untouched: nothing was released.
        assertEq(vault.balanceOf(id), 5 ether);
        assertEq(address(attacker).balance, 0);
        assertEq(vault.getPolicy(id).spent, 0);
    }
}
