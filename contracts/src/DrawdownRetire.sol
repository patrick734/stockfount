// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";
import {GovernanceChecks} from "./governance/GovernanceChecks.sol";

/// @title DrawdownRetire
/// @notice Spends protocol fees on $FOUNT and burns every $FOUNT it holds.
/// @dev There is deliberately no withdrawal or rescue path: assets leave only as burned $FOUNT.
///      Keeper runs are capped per input token and rate-limited, bounding what a bad quote can lose.
///      $FOUNT may be launched on Pons after the protocol deploys. It is then set exactly once, by the
///      admin (the 48h timelock), and is permanent from that point. The deployer has no part in it.
///      Until it is set, fees accumulate here and `drawdown` reverts.
contract DrawdownRetire is AccessControl, ReentrancyGuard {
    /// @notice Release of the StockFount contracts this deployment was built from.
    string public constant VERSION = "1.0.0";

    using SafeERC20 for IERC20;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    /// @notice The token bought and burned. Set at deployment or once later by the admin; never changes after.
    ERC20Burnable public fountToken;
    ISwapAdapter public immutable swapAdapter;

    uint32 public minInterval;
    uint64 public lastDrawdown;
    bool public halted;
    uint256 public totalRetired;
    mapping(address token => uint256) public maxInputPerRun;
    mapping(address token => uint256) public totalSpent;

    event Drawdown(address indexed tokenIn, uint256 amountIn, uint256 fountOut);
    event Retired(uint256 amount, uint256 totalRetired);
    event InputLimitSet(address indexed token, uint256 maxPerRun);
    event MinIntervalSet(uint32 minInterval);
    event HaltSet(bool halted);
    event FountTokenSet(address indexed token);

    error InvalidConfig();
    error FountTokenAlreadySet();
    error FountTokenUnset();
    error IsHalted();
    error OverLimit();
    error TooSoon();
    error SwapShortfall(uint256 received, uint256 minimum);

    /// @param fountToken_ $FOUNT, or zero to set it later through the timelock with `setFountToken`.
    /// @param inputTokens Fee tokens the keeper may spend, with `maxPerRun` caps set atomically here so
    ///        the deployer never needs admin rights to configure them.
    constructor(
        ERC20Burnable fountToken_,
        ISwapAdapter swapAdapter_,
        address admin,
        address guardian,
        address keeper,
        uint32 minInterval_,
        address[] memory inputTokens,
        uint256[] memory maxPerRun
    ) {
        if (
            (address(fountToken_) != address(0) && address(fountToken_).code.length == 0)
                || address(swapAdapter_) == address(0)
                || inputTokens.length != maxPerRun.length
        ) revert InvalidConfig();
        GovernanceChecks.requireRoles(admin, guardian, keeper, msg.sender);
        fountToken = fountToken_;
        if (address(fountToken_) != address(0)) emit FountTokenSet(address(fountToken_));
        swapAdapter = swapAdapter_;
        minInterval = minInterval_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, guardian);
        _grantRole(KEEPER_ROLE, keeper);
        for (uint256 i; i < inputTokens.length; ++i) {
            if (inputTokens[i] == address(0) || inputTokens[i] == address(fountToken_)) revert InvalidConfig();
            maxInputPerRun[inputTokens[i]] = maxPerRun[i];
            emit InputLimitSet(inputTokens[i], maxPerRun[i]);
        }
    }

    /// @notice Sets $FOUNT for a deployment made before the token launched. Admin (timelock) only, and only once.
    /// @dev The token must not already be configured as a fee input, since the drawdown would then try to swap
    ///      $FOUNT into itself; the admin can clear that input limit first.
    function setFountToken(ERC20Burnable token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(fountToken) != address(0)) revert FountTokenAlreadySet();
        if (address(token).code.length == 0 || maxInputPerRun[address(token)] != 0) revert InvalidConfig();
        fountToken = token;
        emit FountTokenSet(address(token));
    }

    /// @notice Swaps `amountIn` of a fee token into $FOUNT and retires the proceeds.
    function drawdown(IERC20 tokenIn, uint256 amountIn, uint256 minFountOut, bytes calldata route)
        external
        onlyRole(KEEPER_ROLE)
        nonReentrant
        returns (uint256 fountOut)
    {
        if (halted) revert IsHalted();
        ERC20Burnable fount = fountToken;
        if (address(fount) == address(0)) revert FountTokenUnset();
        if (
            address(tokenIn) == address(fount) || amountIn == 0 || minFountOut == 0
                || amountIn > maxInputPerRun[address(tokenIn)]
        ) revert OverLimit();
        if (block.timestamp < uint256(lastDrawdown) + minInterval) revert TooSoon();
        lastDrawdown = uint64(block.timestamp);

        uint256 before = fount.balanceOf(address(this));
        tokenIn.forceApprove(address(swapAdapter), amountIn);
        swapAdapter.swap(address(tokenIn), address(fount), amountIn, minFountOut, address(this), route);
        tokenIn.forceApprove(address(swapAdapter), 0);
        fountOut = fount.balanceOf(address(this)) - before;
        if (fountOut < minFountOut) revert SwapShortfall(fountOut, minFountOut);

        totalSpent[address(tokenIn)] += amountIn;
        emit Drawdown(address(tokenIn), amountIn, fountOut);
        _retire(fount.balanceOf(address(this)));
    }

    /// @notice Burns any $FOUNT sent here directly. Callable by anyone. Does nothing before $FOUNT is set.
    function retireHeld() external nonReentrant {
        if (address(fountToken) == address(0)) return;
        _retire(fountToken.balanceOf(address(this)));
    }

    function _retire(uint256 amount) private {
        if (amount == 0) return;
        fountToken.burn(amount);
        totalRetired += amount;
        emit Retired(amount, totalRetired);
    }

    function setInputLimit(address token, uint256 maxPerRun) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxInputPerRun[token] = maxPerRun;
        emit InputLimitSet(token, maxPerRun);
    }

    function setMinInterval(uint32 interval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minInterval = interval;
        emit MinIntervalSet(interval);
    }

    function halt() external onlyRole(GUARDIAN_ROLE) {
        halted = true;
        emit HaltSet(true);
    }

    function resume() external onlyRole(DEFAULT_ADMIN_ROLE) {
        halted = false;
        emit HaltSet(false);
    }
}
